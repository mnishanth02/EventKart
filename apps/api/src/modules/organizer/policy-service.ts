import type { Database } from "@repo/db";
import { and, eq, inArray, isNull } from "@repo/db";
import { consentRecords } from "@repo/db/schema";
import {
	CURRENT_POLICY_VERSIONS,
	type OrganizerPolicyType,
	REQUIRED_ORGANIZER_POLICIES,
} from "@repo/shared/constants";
import type { PolicyStatusResponse } from "@repo/shared/schemas";
import type { FastifyBaseLogger } from "fastify";

export interface PolicyServiceDeps {
	db: Database;
	log: FastifyBaseLogger;
}

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: string }).code === "23505"
	);
}

/**
 * Accept one or more policies for an organizer.
 *
 * Server stamps the current version from CURRENT_POLICY_VERSIONS.
 * Idempotent: if already accepted at current version, treat as success.
 * Transaction-based: query existing → insert only missing → handle 23505 race.
 */
export async function acceptPolicies(
	deps: PolicyServiceDeps,
	userId: string,
	policyTypes: OrganizerPolicyType[],
	ipAddress: string | null,
): Promise<PolicyStatusResponse> {
	const { db, log } = deps;

	await db.transaction(async (tx) => {
		// Find which of the requested policies already have active acceptance at current version
		const existing = await tx
			.select({
				consentType: consentRecords.consentType,
				consentVersion: consentRecords.consentVersion,
			})
			.from(consentRecords)
			.where(
				and(
					eq(consentRecords.participantId, userId),
					inArray(consentRecords.consentType, policyTypes),
					isNull(consentRecords.withdrawnAt),
				),
			);

		const alreadyAccepted = new Set(
			existing
				.filter(
					(r) =>
						CURRENT_POLICY_VERSIONS[r.consentType as OrganizerPolicyType] ===
						r.consentVersion,
				)
				.map((r) => r.consentType),
		);

		const toInsert = policyTypes.filter((pt) => !alreadyAccepted.has(pt));

		if (toInsert.length === 0) {
			log.info({ userId, policyTypes }, "All policies already accepted");
			return;
		}

		const rows = toInsert.map((pt) => ({
			participantId: userId,
			consentType: pt as (typeof consentRecords.consentType.enumValues)[number],
			consentVersion: CURRENT_POLICY_VERSIONS[pt],
			ipAddress: ipAddress ?? undefined,
		}));

		try {
			await tx.insert(consentRecords).values(rows);
		} catch (error: unknown) {
			// Handle race condition: another request inserted concurrently
			if (isUniqueViolation(error)) {
				log.warn(
					{ userId, policyTypes: toInsert },
					"Concurrent policy acceptance detected, treating as success",
				);
				return;
			}
			throw error;
		}

		log.info({ userId, policyTypes: toInsert }, "Policies accepted");
	});

	return getPolicyStatus(db, userId);
}

/**
 * Get policy acceptance status for a user.
 *
 * Returns status for ALL required organizer policies.
 * `allRequiredAccepted` is true only if every required policy
 * is accepted at its current version.
 */
export async function getPolicyStatus(
	db: Database,
	userId: string,
): Promise<PolicyStatusResponse> {
	const records = await db
		.select({
			consentType: consentRecords.consentType,
			consentVersion: consentRecords.consentVersion,
			acceptedAt: consentRecords.acceptedAt,
		})
		.from(consentRecords)
		.where(
			and(
				eq(consentRecords.participantId, userId),
				inArray(consentRecords.consentType, [...REQUIRED_ORGANIZER_POLICIES]),
				isNull(consentRecords.withdrawnAt),
			),
		);

	// Build a map of the latest acceptance per consent type
	const acceptanceMap = new Map<
		string,
		{ version: string; acceptedAt: Date }
	>();

	for (const record of records) {
		const existing = acceptanceMap.get(record.consentType);
		if (!existing || record.acceptedAt > existing.acceptedAt) {
			acceptanceMap.set(record.consentType, {
				version: record.consentVersion,
				acceptedAt: record.acceptedAt,
			});
		}
	}

	const policies = REQUIRED_ORGANIZER_POLICIES.map((policyType) => {
		const currentVersion = CURRENT_POLICY_VERSIONS[policyType];
		const acceptance = acceptanceMap.get(policyType);

		return {
			policyType,
			currentVersion,
			acceptedVersion: acceptance?.version ?? null,
			isCurrentVersionAccepted: acceptance?.version === currentVersion,
			acceptedAt: acceptance?.acceptedAt.toISOString() ?? null,
		};
	});

	const allRequiredAccepted = policies.every((p) => p.isCurrentVersionAccepted);

	return { policies, allRequiredAccepted };
}

/**
 * Boolean helper — returns true if the user has accepted all required
 * organizer policies at their current versions.
 */
export async function hasAcceptedAllPolicies(
	db: Database,
	userId: string,
): Promise<boolean> {
	const status = await getPolicyStatus(db, userId);
	return status.allRequiredAccepted;
}
