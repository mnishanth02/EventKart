import type { Database } from "@repo/db";
import { and, eq, inArray } from "@repo/db";
import { organizers } from "@repo/db/schema";
import type { RazorpayAccountStatus } from "@repo/shared/constants";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, EMAIL_JOB_NAMES } from "@repo/shared/constants";
import type { FastifyBaseLogger } from "fastify";
import { createAuditLogger } from "../../lib/audit.js";
import { logEmailStub } from "../../lib/email-stub.js";
import { NotFoundError } from "../../lib/errors.js";
import type { RazorpayClient } from "../../lib/razorpay.js";

const ALLOWED_TRANSITIONS: RazorpayAccountStatus[] = [
	"not_started",
	"failed",
	"needs_action",
];

/** Map Razorpay API status to internal app status. */
function mapRazorpayStatus(rawStatus: string): RazorpayAccountStatus {
	switch (rawStatus) {
		case "created":
		case "under_review":
			return "pending";
		case "activated":
			return "active";
		case "needs_clarification":
			return "needs_action";
		case "suspended":
			return "suspended";
		default:
			return "pending";
	}
}

/**
 * Create a Razorpay Route linked account for an approved organizer.
 * Idempotent: skips if account already exists in non-retryable state.
 */
export async function createLinkedAccount(
	db: Database,
	log: FastifyBaseLogger,
	razorpayClient: RazorpayClient,
	organizerId: string,
): Promise<{ status: RazorpayAccountStatus; accountId: string | null }> {
	// 1. Fetch organizer
	const orgs = await db
		.select()
		.from(organizers)
		.where(eq(organizers.id, organizerId))
		.limit(1);

	const org = orgs[0];
	if (!org) {
		throw new NotFoundError("Organizer not found");
	}

	// 2. Idempotency check — if already active/pending, skip
	if (
		org.razorpayAccountId &&
		(org.razorpayAccountStatus === "active" ||
			org.razorpayAccountStatus === "pending")
	) {
		log.info(
			{ organizerId, status: org.razorpayAccountStatus },
			"Razorpay account already exists, skipping",
		);
		return {
			status: org.razorpayAccountStatus,
			accountId: org.razorpayAccountId,
		};
	}

	// 3. DB state guard — transition to "pending" (compare-and-set)
	const [transitioned] = await db
		.update(organizers)
		.set({
			razorpayAccountStatus: "pending",
			razorpayLastError: null,
		})
		.where(
			and(
				eq(organizers.id, organizerId),
				inArray(organizers.razorpayAccountStatus, ALLOWED_TRANSITIONS),
			),
		)
		.returning({ id: organizers.id });

	if (!transitioned) {
		log.warn(
			{ organizerId, currentStatus: org.razorpayAccountStatus },
			"Cannot transition to pending — not in allowed state",
		);
		return {
			status: org.razorpayAccountStatus,
			accountId: org.razorpayAccountId,
		};
	}

	// 4. If Razorpay disabled, mark as "not_started" and return
	if (razorpayClient.mode === "disabled") {
		log.warn({ organizerId }, "Razorpay disabled — account not created");
		await db
			.update(organizers)
			.set({ razorpayAccountStatus: "not_started" })
			.where(eq(organizers.id, organizerId));
		return { status: "not_started", accountId: null };
	}

	// 5. Call Razorpay API to create linked account
	try {
		const phone = org.contactPhone.replace("+91", "");

		const accountData = {
			email: org.contactEmail,
			phone,
			type: "route",
			legal_business_name: org.businessName,
			business_type: "partnership",
			contact_name: org.contactName,
			profile: {
				category: "services",
				subcategory: "professional_services",
				addresses: {
					registered: {
						street1: org.city,
						city: org.city,
						state: "Tamil Nadu",
						postal_code: 641001,
						country: "IN",
					},
				},
			},
			legal_info: {},
		};

		const razorpayResponse = await (
			razorpayClient.instance! as any
		).accounts.create(accountData);
		const accountId = razorpayResponse.id as string;
		const rawStatus = (razorpayResponse.status as string) || "created";
		const mappedStatus = mapRazorpayStatus(rawStatus);

		// 6. Update organizer with account info
		const now = new Date();
		await db
			.update(organizers)
			.set({
				razorpayAccountId: accountId,
				razorpayAccountStatus: mappedStatus,
				razorpayLinkedAt: now,
				razorpayRawStatus: rawStatus,
				razorpayLastSyncedAt: now,
				razorpayLastError: null,
			})
			.where(eq(organizers.id, organizerId));

		// 7. Audit log (fire-and-forget)
		const auditLogger = createAuditLogger(db, log);
		void auditLogger.log({
			actorId: org.userId,
			actorRole: "system" as any,
			action: AUDIT_ACTIONS.RAZORPAY_ACCOUNT_CREATE,
			resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
			resourceId: organizerId,
			metadata: { accountId, rawStatus, mappedStatus },
			ipAddress: null,
		});

		log.info(
			{ organizerId, accountId, rawStatus, mappedStatus },
			"Razorpay linked account created",
		);

		// Wave B: log-only email stub on transition to active.
		// Failures must NEVER break the account-creation flow.
		if (mappedStatus === "active") {
			try {
				logEmailStub(log, {
					jobName: EMAIL_JOB_NAMES.RAZORPAY_ACCOUNT_ACTIVE,
					recipientEmail: org.contactEmail,
					resourceId: organizerId,
					suffix: "razorpay_active",
				});
			} catch (emailError) {
				log.info(
					{ err: String(emailError), organizerId, emailStubFailed: true },
					"razorpay.account_active email stub failed (non-fatal)",
				);
			}
		}

		return { status: mappedStatus, accountId };
	} catch (error: unknown) {
		// 8. Handle failure — set status to "failed" with error details
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorDetails =
			error instanceof Error && "statusCode" in error
				? JSON.stringify({
						statusCode: (error as any).statusCode,
						error: (error as any).error,
					})
				: errorMessage;

		await db
			.update(organizers)
			.set({
				razorpayAccountStatus: "failed",
				razorpayLastError: errorDetails,
				razorpayLastSyncedAt: new Date(),
			})
			.where(eq(organizers.id, organizerId));

		// Audit the failure (fire-and-forget)
		const auditLogger = createAuditLogger(db, log);
		void auditLogger.log({
			actorId: org.userId,
			actorRole: "system" as any,
			action: AUDIT_ACTIONS.RAZORPAY_ACCOUNT_CREATE_FAILED,
			resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
			resourceId: organizerId,
			metadata: { error: errorMessage },
			ipAddress: null,
		});

		log.error(
			{ organizerId, error: errorMessage },
			"Failed to create Razorpay linked account",
		);
		throw error; // Let BullMQ retry
	}
}

/**
 * Get publishing eligibility for an organizer.
 * Checks both verification status and Razorpay account status.
 */
export function getPublishingEligibility(org: {
	isVerified: boolean;
	razorpayAccountStatus: RazorpayAccountStatus | string;
}): {
	canPublishFreeEvents: boolean;
	canPublishPaidEvents: boolean;
	reasons: string[];
} {
	const reasons: string[] = [];

	if (!org.isVerified) {
		reasons.push("Organizer verification required");
	}

	if (org.razorpayAccountStatus !== "active") {
		reasons.push("Payment account setup incomplete");
	}

	return {
		canPublishFreeEvents: org.isVerified,
		canPublishPaidEvents:
			org.isVerified && org.razorpayAccountStatus === "active",
		reasons,
	};
}
