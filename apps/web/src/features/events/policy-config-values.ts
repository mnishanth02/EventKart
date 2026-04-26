import type {
	EventPoliciesConfigInput,
	EventPoliciesRecord,
} from "@repo/shared/schemas";

export const DEFAULT_REFUND_POLICY =
	"Refund requests are accepted until seven days before race day. Approved refunds are processed within seven business days, less payment gateway fees.";

export const DEFAULT_CANCELLATION_POLICY =
	"If the organizer cancels the event, registered participants receive a full refund. If the event is postponed, participants may keep their registration or request a refund.";

export function eventPolicyRecordToConfigValues(
	policies: EventPoliciesRecord | null | undefined,
): EventPoliciesConfigInput {
	return {
		refundPolicy: policies?.refundPolicy ?? DEFAULT_REFUND_POLICY,
		cancellationPolicy:
			policies?.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY,
	};
}
