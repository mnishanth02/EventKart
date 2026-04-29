/**
 * Email job names — used as BullMQ job type identifiers in Phase 3.
 * For now (Wave B) these are log-only stubs; NO actual queue enqueue happens.
 */
export const EMAIL_JOB_NAMES = {
	ORGANIZER_WELCOME: "organizer.welcome",
	ORGANIZER_VERIFICATION_APPROVED: "organizer.verification_approved",
	ORGANIZER_VERIFICATION_REJECTED: "organizer.verification_rejected",
	ORGANIZER_RAZORPAY_READY: "organizer.razorpay_ready",
	EVENT_REVIEW_SUBMITTED: "event.review_submitted",
	EVENT_REVIEW_APPROVED: "event.review_approved",
	EVENT_REVIEW_REJECTED: "event.review_rejected",
} as const;

export type EmailJobName = (typeof EMAIL_JOB_NAMES)[keyof typeof EMAIL_JOB_NAMES];

export const buildEmailIdempotencyKey = {
	organizerWelcome: (organizerId: string) => `welcome:${organizerId}`,
	verificationApproved: (organizerId: string, reviewedAt: Date) =>
		`verification-approved:${organizerId}:${reviewedAt.toISOString()}`,
	verificationRejected: (organizerId: string, reviewedAt: Date) =>
		`verification-rejected:${organizerId}:${reviewedAt.toISOString()}`,
	razorpayReady: (organizerId: string, syncedAt: Date) =>
		`razorpay-ready:${organizerId}:${syncedAt.toISOString()}`,
	eventReviewSubmitted: (eventId: string, submittedAt: Date) =>
		`event-review-submitted:${eventId}:${submittedAt.toISOString()}`,
	eventReviewApproved: (eventId: string, reviewedAt: Date) =>
		`event-review-approved:${eventId}:${reviewedAt.toISOString()}`,
	eventReviewRejected: (eventId: string, reviewedAt: Date) =>
		`event-review-rejected:${eventId}:${reviewedAt.toISOString()}`,
} as const;
