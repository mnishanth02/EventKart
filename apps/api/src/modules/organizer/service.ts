import type { Database } from "@repo/db";
import { and, eq, isNull } from "@repo/db";
import { organizers } from "@repo/db/schema";
import {
	buildEmailIdempotencyKey,
	EMAIL_JOB_NAMES,
} from "@repo/shared/constants";
import type {
	OrganizerRegistration,
	OrganizerUpdate,
} from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";
import { emitEmailStub } from "../../lib/email-stub.js";
import { ConflictError } from "../../lib/errors.js";
import {
	recordOrganizerSlugRedirect,
	reserveUniqueOrganizerSlug,
} from "./slug-service.js";

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: string }).code === "23505"
	);
}

export interface RegisterOrganizerDeps {
	db: Database;
	log: FastifyBaseLogger;
}

export interface OrganizerRow {
	id: string;
	userId: string;
	slug: string;
	businessName: string;
	contactName: string;
	contactEmail: string;
	contactPhone: string;
	city: string;
	description: string | null;
	website: string | null;
	verificationStatus: string;
	isVerified: boolean;
	submittedForReviewAt: Date | null;
	reviewedAt: Date | null;
	rejectionReason: string | null;
	razorpayAccountStatus: string;
	razorpayAccountId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

function toProfileResponse(row: OrganizerRow) {
	return {
		id: row.id,
		userId: row.userId,
		slug: row.slug,
		businessName: row.businessName,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		city: row.city,
		description: row.description,
		website: row.website,
		verificationStatus: row.verificationStatus,
		isVerified: row.isVerified,
		razorpayAccountStatus: row.razorpayAccountStatus,
		submittedForReviewAt: row.submittedForReviewAt?.toISOString() ?? null,
		reviewedAt: row.reviewedAt?.toISOString() ?? null,
		rejectionReason: row.rejectionReason,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/**
 * Register a new organizer profile for an authenticated user.
 * Throws ConflictError if the user already has an organizer profile.
 */
export async function registerOrganizer(
	deps: RegisterOrganizerDeps,
	userId: string,
	data: OrganizerRegistration,
) {
	const { db, log } = deps;

	// Optimistic check (fast path for user-friendly error message)
	const existing = await db
		.select({ id: organizers.id })
		.from(organizers)
		.where(and(eq(organizers.userId, userId), isNull(organizers.deletedAt)))
		.limit(1);

	if (existing.length > 0) {
		throw new ConflictError("Organizer profile already exists for this user");
	}

	const slug = await reserveUniqueOrganizerSlug(db, data.businessName);

	let inserted: OrganizerRow;
	try {
		const [row] = await db
			.insert(organizers)
			.values({
				userId,
				slug,
				businessName: data.businessName,
				contactName: data.contactName,
				contactEmail: data.contactEmail,
				contactPhone: data.contactPhone,
				city: data.city,
				description: data.description ?? null,
				website: data.website ?? null,
			})
			.returning();

		if (!row) {
			throw new Error("Failed to insert organizer record");
		}
		inserted = row as OrganizerRow;
	} catch (error: unknown) {
		// Handle race condition on userId uniqueness. If another constraint fires
		// (e.g., slug collision from concurrent registration with same businessName),
		// re-check whether the organizer row now exists for this userId before
		// surfacing a misleading "already exists" error.
		if (isUniqueViolation(error)) {
			const recheckRows = await db
				.select({ id: organizers.id })
				.from(organizers)
				.where(and(eq(organizers.userId, userId), isNull(organizers.deletedAt)))
				.limit(1);
			if (recheckRows.length > 0) {
				throw new ConflictError(
					"Organizer profile already exists for this user",
				);
			}
			// Slug collision from concurrent registration — surface as a transient error
			throw new ConflictError(
				"Unable to reserve a unique organizer slug. Please try again.",
			);
		}
		throw error;
	}

	log.info({ organizerId: inserted.id, userId }, "Organizer profile created");

	// Wave B: log-only email stub. Failures must NEVER break registration.
	try {
		emitEmailStub(
			{ log },
			{
				jobName: EMAIL_JOB_NAMES.ORGANIZER_WELCOME,
				idempotencyKey: buildEmailIdempotencyKey.organizerWelcome(inserted.id),
				context: { organizerId: inserted.id },
			},
		);
	} catch (emailError) {
		log.info(
			{
				err: String(emailError),
				organizerId: inserted.id,
				emailStubFailed: true,
			},
			"organizer.registered email stub failed (non-fatal)",
		);
	}

	return toProfileResponse(inserted as OrganizerRow);
}

/**
 * Get the organizer profile for a given user ID.
 * Returns null if no profile exists.
 */
export async function getOrganizerByUserId(db: Database, userId: string) {
	const rows = await db
		.select()
		.from(organizers)
		.where(and(eq(organizers.userId, userId), isNull(organizers.deletedAt)))
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	return toProfileResponse(row as OrganizerRow);
}

export interface UpdateOrganizerDeps {
	db: Database;
	log: Pick<FastifyBaseLogger, "info">;
}

/**
 * Update an existing organizer profile for the given user.
 * Returns null if no profile exists (let the route throw 404).
 */
export async function updateOrganizer(
	deps: UpdateOrganizerDeps,
	userId: string,
	data: OrganizerUpdate,
) {
	const { db, log } = deps;

	const updateFields: Record<string, unknown> = {};
	if (data.businessName !== undefined)
		updateFields.businessName = data.businessName;
	if (data.contactName !== undefined)
		updateFields.contactName = data.contactName;
	if (data.contactEmail !== undefined)
		updateFields.contactEmail = data.contactEmail;
	if (data.contactPhone !== undefined)
		updateFields.contactPhone = data.contactPhone;
	if (data.city !== undefined) updateFields.city = data.city;
	if (data.description !== undefined)
		updateFields.description = data.description;
	if (data.website !== undefined) updateFields.website = data.website;

	const updated = await db.transaction(async (tx) => {
		const [existing] = await tx
			.select({
				id: organizers.id,
				slug: organizers.slug,
				businessName: organizers.businessName,
			})
			.from(organizers)
			.where(and(eq(organizers.userId, userId), isNull(organizers.deletedAt)))
			.limit(1);

		if (!existing) {
			return null;
		}

		if (
			data.businessName !== undefined &&
			data.businessName !== existing.businessName
		) {
			const newSlug = await reserveUniqueOrganizerSlug(tx, data.businessName, {
				excludeOrganizerId: existing.id,
			});
			if (newSlug !== existing.slug) {
				updateFields.slug = newSlug;
			}
		}

		const [row] = await tx
			.update(organizers)
			.set(updateFields)
			.where(eq(organizers.userId, userId))
			.returning();

		if (!row) {
			return null;
		}

		if (
			typeof updateFields.slug === "string" &&
			existing.slug !== updateFields.slug
		) {
			await recordOrganizerSlugRedirect(tx, {
				organizerId: existing.id,
				oldSlug: existing.slug,
				newSlug: updateFields.slug,
			});
		}

		return row;
	});

	if (!updated) {
		return null;
	}

	log.info(
		{
			organizerId: updated.id,
			userId,
			updatedFields: Object.keys(updateFields),
		},
		"Organizer profile updated",
	);

	return toProfileResponse(updated as OrganizerRow);
}
