import type { Database } from "@repo/db";
import { and, eq, inArray, sql } from "@repo/db";
import { events, organizers } from "@repo/db/schema";
import type { AdminEventReviewListParams, Event } from "@repo/shared/schemas";
import { eventSchema } from "@repo/shared/schemas";
import type { Queue } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { AuditLogger } from "../../lib/audit.js";
import { NotFoundError } from "../../lib/errors.js";
import type { CdnPurgePayload } from "../../queues/cdn-purge.js";
import {
	adminApproveEvent,
	adminRejectEvent,
	getPublishedPaidEventCount,
} from "../events/service.js";

interface AdminEventReviewDeps {
	db: Database;
	log: Pick<FastifyBaseLogger, "info">;
	auditLogger: AuditLogger;
	/**
	 * Public-event Redis cache (I-2.4.3) — passed through to
	 * `adminApproveEvent` so an admin-approved publish evicts the
	 * cached projection. Rejection (I-2.4.2) also forwards through to
	 * a defense-in-depth purge for previously-published re-submissions.
	 */
	cache?: Redis;
	/**
	 * I-2.4.2: Cloudflare CDN purge queue + base URL — forwarded to
	 * both `adminApproveEvent` (purge new public URL) and
	 * `adminRejectEvent` (purge previously-public URL after rejection).
	 * Both are optional; tests omit them and the underlying service
	 * helpers no-op gracefully.
	 */
	cdnPurgeQueue?: Queue<CdnPurgePayload>;
	cdnBaseUrl?: string;
}

function eventDate(value: Date | null): string | null {
	return value?.toISOString() ?? null;
}

async function getPublishedPaidCounts(
	db: Database,
	organizerIds: readonly string[],
): Promise<Map<string, number>> {
	if (organizerIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			organizerId: events.organizerId,
			total: sql<number>`count(*)`,
		})
		.from(events)
		.where(
			and(
				inArray(events.organizerId, [...new Set(organizerIds)]),
				eq(events.status, "published"),
				eq(events.isPaid, true),
			),
		)
		.groupBy(events.organizerId);

	return new Map(
		rows.map((row) => [row.organizerId, Number(row.total)] as const),
	);
}

export async function listEventReviews(
	db: Database,
	params: AdminEventReviewListParams,
) {
	const { page, limit, status } = params;
	const offset = (page - 1) * limit;
	const condition = eq(events.status, status);

	const countRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(events)
		.where(condition);
	const total = Number(countRows[0]?.total ?? 0);

	const rows = await db
		.select({
			eventId: events.id,
			organizerId: events.organizerId,
			title: events.title,
			slug: events.slug,
			status: events.status,
			startAt: events.startAt,
			submittedForReviewAt: events.submittedForReviewAt,
			organizerBusinessName: organizers.businessName,
			organizerContactEmail: organizers.contactEmail,
		})
		.from(events)
		.innerJoin(organizers, eq(events.organizerId, organizers.id))
		.where(condition)
		.orderBy(sql`${events.submittedForReviewAt} ASC NULLS LAST`, events.id)
		.limit(limit)
		.offset(offset);

	const publishedCounts = await getPublishedPaidCounts(
		db,
		rows.map((row) => row.organizerId),
	);
	const totalPages = Math.ceil(total / limit);

	return {
		data: rows.map((row) => ({
			eventId: row.eventId,
			organizerId: row.organizerId,
			title: row.title,
			slug: row.slug,
			status: row.status,
			startAt: row.startAt.toISOString(),
			submittedForReviewAt: eventDate(row.submittedForReviewAt),
			organizerBusinessName: row.organizerBusinessName,
			organizerContactEmail: row.organizerContactEmail,
			previouslyPublishedPaidEventCount:
				publishedCounts.get(row.organizerId) ?? 0,
		})),
		meta: {
			page,
			limit,
			total,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1,
		},
	};
}

export async function getEventReviewDetail(db: Database, eventId: string) {
	const [row] = await db
		.select({
			event: events,
			organizer: {
				id: organizers.id,
				userId: organizers.userId,
				businessName: organizers.businessName,
				contactName: organizers.contactName,
				contactEmail: organizers.contactEmail,
				city: organizers.city,
				isVerified: organizers.isVerified,
				razorpayAccountStatus: organizers.razorpayAccountStatus,
			},
		})
		.from(events)
		.innerJoin(organizers, eq(events.organizerId, organizers.id))
		.where(eq(events.id, eventId))
		.limit(1);

	if (!row) {
		throw new NotFoundError("Event review not found");
	}

	const previouslyPublishedPaidEventCount = await getPublishedPaidEventCount(
		db,
		row.organizer.id,
	);

	const event = eventSchema.parse({
		...row.event,
		startAt: row.event.startAt.toISOString(),
		endAt: row.event.endAt.toISOString(),
		registrationOpensAt: eventDate(row.event.registrationOpensAt),
		registrationClosesAt: eventDate(row.event.registrationClosesAt),
		publishedAt: eventDate(row.event.publishedAt),
		submittedForReviewAt: eventDate(row.event.submittedForReviewAt),
		createdAt: row.event.createdAt.toISOString(),
		updatedAt: row.event.updatedAt.toISOString(),
	}) satisfies Event;

	return {
		event,
		organizer: {
			...row.organizer,
			previouslyPublishedPaidEventCount,
		},
	};
}

export async function approveEventReview(
	deps: AdminEventReviewDeps,
	eventId: string,
	adminUserId: string,
	ipAddress: string | null,
	notes?: string,
) {
	const result = await adminApproveEvent(
		deps,
		eventId,
		adminUserId,
		ipAddress ?? undefined,
		notes,
	);

	return {
		event: result.event,
		transition: result.transition,
		reviewedAt: new Date().toISOString(),
		reviewedBy: adminUserId,
	};
}

export async function rejectEventReview(
	deps: AdminEventReviewDeps,
	eventId: string,
	adminUserId: string,
	reason: string,
	ipAddress: string | null,
) {
	const result = await adminRejectEvent(
		deps,
		eventId,
		adminUserId,
		reason,
		ipAddress ?? undefined,
	);

	return {
		event: result.event,
		transition: result.transition,
		reviewedAt: new Date().toISOString(),
		reviewedBy: adminUserId,
	};
}
