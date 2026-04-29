/**
 * Email job names — used as BullMQ job type identifiers in Phase 3.
 * For now (Wave B) these are log-only stubs; NO actual queue enqueue happens.
 */
export const EMAIL_JOB_NAMES = {
	ORGANIZER_REGISTRATION: "email.organizer_registration",
	ORGANIZER_APPROVED: "email.organizer_approved",
	ORGANIZER_REJECTED: "email.organizer_rejected",
	RAZORPAY_ACCOUNT_ACTIVE: "email.razorpay_account_active",
	EVENT_PUBLISHED: "email.event_published",
	EVENT_ADMIN_APPROVED: "email.event_admin_approved",
	EVENT_ADMIN_REJECTED: "email.event_admin_rejected",
} as const;

export type EmailJobName = (typeof EMAIL_JOB_NAMES)[keyof typeof EMAIL_JOB_NAMES];

/** Builds a deterministic idempotency key for a given job trigger. */
export function buildEmailIdempotencyKey(
	jobName: EmailJobName,
	resourceId: string,
	suffix?: string,
): string {
	return suffix
		? `${jobName}:${resourceId}:${suffix}`
		: `${jobName}:${resourceId}`;
}
