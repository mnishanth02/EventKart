import type { FastifyBaseLogger } from "fastify";
import type { Database } from "@repo/db";
import { organizers } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import type { OrganizerRegistration } from "@repo/shared/schemas";
import { ConflictError } from "../../lib/errors.js";

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
	businessName: string;
	contactName: string;
	contactEmail: string;
	contactPhone: string;
	city: string;
	description: string | null;
	website: string | null;
	verificationStatus: string;
	isVerified: boolean;
	createdAt: Date;
	updatedAt: Date;
}

function toProfileResponse(row: OrganizerRow) {
	return {
		id: row.id,
		userId: row.userId,
		businessName: row.businessName,
		contactName: row.contactName,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		city: row.city,
		description: row.description,
		website: row.website,
		verificationStatus: row.verificationStatus,
		isVerified: row.isVerified,
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
		.where(eq(organizers.userId, userId))
		.limit(1);

	if (existing.length > 0) {
		throw new ConflictError(
			"Organizer profile already exists for this user",
		);
	}

	let inserted: OrganizerRow;
	try {
		const [row] = await db
			.insert(organizers)
			.values({
				userId,
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
		// Handle race condition: unique constraint on userId
		if (isUniqueViolation(error)) {
			throw new ConflictError(
				"Organizer profile already exists for this user",
			);
		}
		throw error;
	}

	log.info(
		{ organizerId: inserted.id, userId },
		"Organizer profile created",
	);

	return toProfileResponse(inserted as OrganizerRow);
}

/**
 * Get the organizer profile for a given user ID.
 * Returns null if no profile exists.
 */
export async function getOrganizerByUserId(
	db: Database,
	userId: string,
) {
	const rows = await db
		.select()
		.from(organizers)
		.where(eq(organizers.userId, userId))
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	return toProfileResponse(row as OrganizerRow);
}
