import { z } from "zod/v4";

/** Internal app-level statuses for Razorpay linked account lifecycle. */
export const RAZORPAY_ACCOUNT_STATUSES = [
	"not_started",
	"pending",
	"active",
	"needs_action",
	"suspended",
	"failed",
] as const;

export type RazorpayAccountStatus = (typeof RAZORPAY_ACCOUNT_STATUSES)[number];

export const razorpayAccountStatusSchema = z.enum(RAZORPAY_ACCOUNT_STATUSES);

/** Human-readable labels for Razorpay account statuses. */
export const RAZORPAY_ACCOUNT_STATUS_LABELS: Record<
	RazorpayAccountStatus,
	string
> = {
	not_started: "Not Started",
	pending: "Pending",
	active: "Active",
	needs_action: "Needs Action",
	suspended: "Suspended",
	failed: "Failed",
} as const;

/** States that allow manual retry of Razorpay account creation. */
export const RAZORPAY_RETRYABLE_STATUSES: readonly RazorpayAccountStatus[] = [
	"not_started",
	"failed",
	"needs_action",
] as const;
