/**
 * Known audit log actions.
 * Format: <domain>.<verb> (e.g., "auth.login", "organizer.approve")
 * New actions should be added here as features are built.
 */
export const AUDIT_ACTIONS = {
	// Auth
	AUTH_LOGIN: "auth.login",
	AUTH_LOGOUT: "auth.logout",
	AUTH_SESSION_REVOKE: "auth.session_revoke",
	// User
	USER_CREATE: "user.create",
	USER_UPDATE: "user.update",
	USER_DELETE: "user.delete",
	USER_ROLE_CHANGE: "user.role_change",
	// Organizer
	ORGANIZER_REGISTER: "organizer.register",
	ORGANIZER_APPROVE: "organizer.approve",
	ORGANIZER_REJECT: "organizer.reject",
	ORGANIZER_SUSPEND: "organizer.suspend",
	ORGANIZER_DOCUMENT_UPLOAD: "organizer.document_upload",
	ORGANIZER_DOCUMENT_CONFIRM: "organizer.document_confirm",
	ORGANIZER_DOCUMENT_DELETE: "organizer.document_delete",
	ORGANIZER_DOCUMENT_VIEW: "organizer.document_view",
	ORGANIZER_PROFILE_UPDATE: "organizer.profile_update",
	// Razorpay
	RAZORPAY_ACCOUNT_CREATE: "razorpay.account_create",
	RAZORPAY_ACCOUNT_CREATE_FAILED: "razorpay.account_create_failed",
	RAZORPAY_ACCOUNT_STATUS_CHANGE: "razorpay.account_status_change",
	RAZORPAY_ACCOUNT_RETRY: "razorpay.account_retry",
	// Event
	EVENT_CREATE: "event.create",
	EVENT_UPDATE: "event.update",
	EVENT_PUBLISH: "event.publish",
	EVENT_UNPUBLISH: "event.unpublish",
	EVENT_CANCEL: "event.cancel",
	EVENT_IMAGE_UPLOAD_REQUEST: "event.image_upload_request",
	EVENT_IMAGE_UPLOAD_CONFIRM: "event.image_upload_confirm",
	EVENT_IMAGE_DELETE: "event.image_delete",
	// Booking
	BOOKING_CREATE: "booking.create",
	BOOKING_CANCEL: "booking.cancel",
	BOOKING_REFUND: "booking.refund",
	// Admin
	ADMIN_REVIEW: "admin.review",
	ADMIN_ACTION: "admin.action",
	// System
	SYSTEM_MIGRATION: "system.migration",
	SYSTEM_CLEANUP: "system.cleanup",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_RESOURCE_TYPES = {
	USER: "user",
	SESSION: "session",
	ORGANIZER: "organizer",
	EVENT: "event",
	BOOKING: "booking",
	PAYMENT: "payment",
	VERIFICATION: "verification",
	DOCUMENT: "document",
	DISPUTE: "dispute",
	PAYOUT: "payout",
} as const;

export type AuditResourceType =
	(typeof AUDIT_RESOURCE_TYPES)[keyof typeof AUDIT_RESOURCE_TYPES];
