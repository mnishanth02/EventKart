import { describe, expect, it } from "vitest";
import { EVENT_POLICY_MAX_LENGTH } from "../../src/constants/event";
import {
	eventPoliciesConfigSchema,
	eventPoliciesRecordSchema,
} from "../../src/schemas/event-policy";

describe("eventPoliciesConfigSchema", () => {
	it("trims policy text before saving", () => {
		const result = eventPoliciesConfigSchema.parse({
			refundPolicy:
				"  Refunds are available until seven days before race day.  ",
			cancellationPolicy: "  Event cancellation notices are sent by email.  ",
		});

		expect(result).toEqual({
			refundPolicy: "Refunds are available until seven days before race day.",
			cancellationPolicy: "Event cancellation notices are sent by email.",
		});
	});

	it("rejects blank policy text", () => {
		const result = eventPoliciesConfigSchema.safeParse({
			refundPolicy: "   ",
			cancellationPolicy: "Cancellation terms are available.",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(["refundPolicy"]);
		}
	});

	it("rejects policy text over the shared max length", () => {
		const result = eventPoliciesConfigSchema.safeParse({
			refundPolicy: "R".repeat(EVENT_POLICY_MAX_LENGTH + 1),
			cancellationPolicy: "Cancellation terms are available.",
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toContain(
				String(EVENT_POLICY_MAX_LENGTH),
			);
		}
	});
});

describe("eventPoliciesRecordSchema", () => {
	it("accepts nullable persisted policy fields for draft events", () => {
		const result = eventPoliciesRecordSchema.parse({
			eventId: "11111111-1111-4111-8111-111111111111",
			refundPolicy: null,
			cancellationPolicy: null,
			updatedAt: "2026-04-26T12:00:00.000Z",
		});

		expect(result.refundPolicy).toBeNull();
		expect(result.cancellationPolicy).toBeNull();
	});
});
