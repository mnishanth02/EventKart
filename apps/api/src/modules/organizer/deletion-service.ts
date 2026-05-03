import { and, eq, isNull, sql, type Database } from "@repo/db";
import {
	eventImages,
	events,
	organizers,
	sessions,
	slugRedirects,
	users,
	verificationDocuments,
} from "@repo/db/schema";
import {
	AUDIT_ACTIONS,
	AUDIT_RESOURCE_TYPES,
	buildEmailIdempotencyKey,
	EMAIL_JOB_NAMES,
} from "@repo/shared/constants";
import type { Queue } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";

import type { AuditLogger } from "../../lib/audit.js";
import {
	invalidatePublicEventCache,
	invalidatePublicOrganizerCache,
} from "../../lib/cache-stampede.js";
import { emitEmailStub } from "../../lib/email-stub.js";
import { NotFoundError } from "../../lib/errors.js";
import type { StorageClient } from "../../lib/storage.js";
import {
	enqueueCdnPurge,
	type CdnPurgePayload,
} from "../../queues/cdn-purge.js";
import { enqueueSitemapRegen } from "../../queues/sitemap-regen.js";
import { deleteRedisSession } from "../../lib/session.js";

// ─── Preview ────────────────────────────────────────────────────────────────

export interface PreviewOrganizerDeletionResult {
	businessName: string;
	futureEvents: {
		id: string;
		slug: string;
		title: string;
		startAt: Date;
		status: string;
	}[];
	preservedEventCount: number;
	hasRazorpayAccount: boolean;
	kycDocumentCount: number;
}

export async function previewOrganizerDeletion(
	db: Database,
	userId: string,
): Promise<PreviewOrganizerDeletionResult> {
	const [organizer] = await db
		.select({
			id: organizers.id,
			businessName: organizers.businessName,
			razorpayAccountId: organizers.razorpayAccountId,
			deletedAt: organizers.deletedAt,
		})
		.from(organizers)
		.where(and(eq(organizers.userId, userId), isNull(organizers.deletedAt)))
		.limit(1);

	if (!organizer) {
		throw new NotFoundError("Organizer profile not found");
	}

	const now = new Date();

	const allEvents = await db
		.select({
			id: events.id,
			slug: events.slug,
			title: events.title,
			startAt: events.startAt,
			status: events.status,
		})
		.from(events)
		.where(eq(events.organizerId, organizer.id));

	const futureEvents = allEvents.filter((e) => e.startAt > now);
	const preservedEventCount = allEvents.length - futureEvents.length;

	const [kycCount] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(verificationDocuments)
		.where(eq(verificationDocuments.organizerId, organizer.id));

	return {
		businessName: organizer.businessName,
		futureEvents,
		preservedEventCount,
		hasRazorpayAccount: organizer.razorpayAccountId !== null,
		kycDocumentCount: kycCount?.count ?? 0,
	};
}

// ─── Delete Transaction ─────────────────────────────────────────────────────

export interface DeleteOrganizerAccountDeps {
	db: Database;
	log: FastifyBaseLogger;
	auditLogger: AuditLogger;
}

export interface DeleteOrganizerAccountContext {
	ip: string;
	sessionId: string;
}

export interface DeleteOrganizerAccountResult {
	organizerSlug: string;
	deletedEventSlugs: string[];
	preservedEventSlugs: string[];
	deletedEventCount: number;
	preservedEventCount: number;
	sessionIds: string[];
	storageKeys: string[];
	razorpayAccountId: string | null;
}

export async function deleteOrganizerAccount(
	deps: DeleteOrganizerAccountDeps,
	userId: string,
	ctx: DeleteOrganizerAccountContext,
): Promise<DeleteOrganizerAccountResult> {
	const { db, log, auditLogger } = deps;

	return db.transaction(async (tx) => {
		// 1. Lock organizer row
		const [organizer] = await tx
			.select({
				id: organizers.id,
				slug: organizers.slug,
				razorpayAccountId: organizers.razorpayAccountId,
				deletedAt: organizers.deletedAt,
			})
			.from(organizers)
			.where(eq(organizers.userId, userId))
			.for("update");

		if (!organizer || organizer.deletedAt !== null) {
			throw new NotFoundError("Organizer profile not found or already deleted");
		}

		const organizerId = organizer.id;
		const now = new Date();

		// 2. Fetch all events for this organizer
		// TODO(I-3.x): When bookings ship, refuse deletion if any future event has paid bookings
		const allEvents = await tx
			.select({
				id: events.id,
				slug: events.slug,
				startAt: events.startAt,
				status: events.status,
			})
			.from(events)
			.where(eq(events.organizerId, organizerId));

		const futureEvents = allEvents.filter((e) => e.startAt > now);
		const preservedEvents = allEvents.filter((e) => e.startAt <= now);

		// 3. For each future event: collect storage keys, delete slug redirects, delete event
		const storageKeys: string[] = [];

		for (const event of futureEvents) {
			const images = await tx
				.select({ storageKey: eventImages.storageKey })
				.from(eventImages)
				.where(
					and(
						eq(eventImages.eventId, event.id),
						sql`${eventImages.status} IN ('pending', 'uploaded')`,
					),
				);

			for (const img of images) {
				storageKeys.push(img.storageKey);
			}

			await tx
				.delete(slugRedirects)
				.where(
					and(
						eq(slugRedirects.resourceType, "event"),
						eq(slugRedirects.resourceId, event.id),
					),
				);

			// Cascade deletes event_categories, event_pricing_tiers, event_images
			await tx.delete(events).where(eq(events.id, event.id));
		}

		// 4. Delete organizer slug redirects
		await tx
			.delete(slugRedirects)
			.where(
				and(
					eq(slugRedirects.resourceType, "organizer"),
					eq(slugRedirects.resourceId, organizerId),
				),
			);

		// 5. Soft-delete organizer
		await tx
			.update(organizers)
			.set({
				deletedAt: now,
				razorpayAccountId: null,
				razorpayAccountStatus: "not_started",
			})
			.where(eq(organizers.id, organizerId));

		// 6. Downgrade user role
		await tx
			.update(users)
			.set({ role: "participant" })
			.where(eq(users.id, userId));

		// 7. Collect active session IDs
		const activeSessions = await tx
			.select({ id: sessions.id })
			.from(sessions)
			.where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

		const sessionIds = activeSessions.map((s) => s.id);

		// 8. Revoke all sessions in DB
		if (sessionIds.length > 0) {
			await tx
				.update(sessions)
				.set({ revokedAt: now })
				.where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
		}

		// 9. Audit log
		await auditLogger.log({
			actorId: userId,
			actorRole: "organizer",
			action: AUDIT_ACTIONS.ORGANIZER_DELETE,
			resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
			resourceId: organizerId,
			metadata: {
				deletedEventCount: futureEvents.length,
				preservedEventCount: preservedEvents.length,
				sessionCount: sessionIds.length,
			},
			ipAddress: ctx.ip,
		});

		log.info(
			{
				organizerId,
				userId,
				deletedEvents: futureEvents.length,
				preservedEvents: preservedEvents.length,
				revokedSessions: sessionIds.length,
			},
			"Organizer account deleted",
		);

		return {
			organizerSlug: organizer.slug,
			deletedEventSlugs: futureEvents.map((e) => e.slug),
			preservedEventSlugs: preservedEvents.map((e) => e.slug),
			deletedEventCount: futureEvents.length,
			preservedEventCount: preservedEvents.length,
			sessionIds,
			storageKeys,
			razorpayAccountId: organizer.razorpayAccountId,
		};
	});
}

// ─── Post-transaction side effects ─────────────────────────────────────────

export interface DeletionSideEffectsDeps {
	log: FastifyBaseLogger;
	redis: {
		session: Redis;
		cache: Redis;
	};
	storage: StorageClient;
	cdnPurgeQueue?: Queue<CdnPurgePayload>;
	cdnBaseUrl?: string;
	sitemapRegenQueue?: Queue;
}

export async function runDeletionSideEffects(
	deps: DeletionSideEffectsDeps,
	result: DeleteOrganizerAccountResult,
): Promise<void> {
	const { log, redis, storage, cdnPurgeQueue, cdnBaseUrl, sitemapRegenQueue } =
		deps;
	const {
		organizerSlug,
		deletedEventSlugs,
		preservedEventSlugs,
		sessionIds,
		storageKeys,
		razorpayAccountId,
	} = result;

	// 1. Session kill across devices (AWAITED — critical for security)
	// Auth plugin reads from Redis only, so failing to delete means the session
	// stays authenticated with the old "organizer" role until TTL expiry.
	const failedSessionIds: string[] = [];
	for (const sessionId of sessionIds) {
		try {
			await deleteRedisSession(redis.session, sessionId);
		} catch (_firstErr) {
			// Retry once before giving up
			try {
				await deleteRedisSession(redis.session, sessionId);
			} catch (retryErr) {
				failedSessionIds.push(sessionId);
				log.error(
					{ err: String(retryErr), sessionId },
					"Failed to delete Redis session after retry",
				);
			}
		}
	}
	if (failedSessionIds.length > 0) {
		log.error(
			{ failedSessionIds, total: sessionIds.length },
			"Some Redis sessions could not be revoked — these sessions will remain active until TTL expiry",
		);
	}

	// 2. Origin cache eviction (fire-and-forget)
	try {
		void invalidatePublicOrganizerCache(redis.cache, organizerSlug);
		const allSlugs = [...deletedEventSlugs, ...preservedEventSlugs];
		for (const slug of allSlugs) {
			void invalidatePublicEventCache(redis.cache, slug);
		}
	} catch (err) {
		log.error(
			{ err: String(err) },
			"Cache eviction error during deletion side effects (non-fatal)",
		);
	}

	// 3. CDN purge (fire-and-forget)
	try {
		if (cdnPurgeQueue && cdnBaseUrl) {
			const allSlugs = [...deletedEventSlugs, ...preservedEventSlugs];
			const urls = [
				`${cdnBaseUrl}/organizers/${organizerSlug}`,
				...allSlugs.map((slug) => `${cdnBaseUrl}/events/${slug}`),
				`${cdnBaseUrl}/sitemap.xml`,
			];
			void enqueueCdnPurge(
				cdnPurgeQueue,
				{ urls, reason: "organizer_account_deleted" },
				log,
			);
		}
	} catch (err) {
		log.error(
			{ err: String(err) },
			"CDN purge enqueue failed during deletion (non-fatal)",
		);
	}

	// 4. Sitemap regen (fire-and-forget)
	try {
		void enqueueSitemapRegen(sitemapRegenQueue, {
			reason: "organizer_account_deleted",
		});
	} catch (err) {
		log.error(
			{ err: String(err) },
			"Sitemap regen enqueue failed during deletion (non-fatal)",
		);
	}

	// 5. S3 object cleanup (fire-and-forget)
	if (storageKeys.length > 0) {
		void Promise.allSettled(
			storageKeys.map((key) => storage.deleteObject(key)),
		).then((results) => {
			const failures = results.filter((r) => r.status === "rejected");
			if (failures.length > 0) {
				log.error(
					{ failedCount: failures.length, totalKeys: storageKeys.length },
					"Some S3 object deletions failed during organizer cleanup (non-fatal)",
				);
			}
		});
	}

	// 6. Razorpay suspend (placeholder)
	if (razorpayAccountId) {
		// TODO(razorpay-suspend): Suspend linked account ${razorpayAccountId}
		log.info(
			{ razorpayAccountId },
			"TODO(razorpay-suspend): Razorpay account should be suspended",
		);
	}

	// 7. Email stub
	try {
		emitEmailStub(
			{ log },
			{
				jobName: EMAIL_JOB_NAMES.ORGANIZER_ACCOUNT_DELETED,
				idempotencyKey:
					buildEmailIdempotencyKey.organizerAccountDeleted(organizerSlug),
				context: { organizerSlug, deletedEventCount: deletedEventSlugs.length },
			},
		);
	} catch (err) {
		log.error(
			{ err: String(err) },
			"Email stub failed during deletion side effects (non-fatal)",
		);
	}
}
