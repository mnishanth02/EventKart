import { describe, expect, it } from "vitest";
import { getPublishingEligibility } from "../../../src/modules/payment/razorpay-account-service.js";

describe("getPublishingEligibility", () => {
	it("allows both free and paid when verified + active", () => {
		const result = getPublishingEligibility({
			isVerified: true,
			razorpayAccountStatus: "active",
		});

		expect(result.canPublishFreeEvents).toBe(true);
		expect(result.canPublishPaidEvents).toBe(true);
		expect(result.reasons).toHaveLength(0);
	});

	it("allows free but not paid when verified + pending", () => {
		const result = getPublishingEligibility({
			isVerified: true,
			razorpayAccountStatus: "pending",
		});

		expect(result.canPublishFreeEvents).toBe(true);
		expect(result.canPublishPaidEvents).toBe(false);
		expect(result.reasons).toContain("Payment account setup incomplete");
	});

	it("allows free but not paid when verified + not_started", () => {
		const result = getPublishingEligibility({
			isVerified: true,
			razorpayAccountStatus: "not_started",
		});

		expect(result.canPublishFreeEvents).toBe(true);
		expect(result.canPublishPaidEvents).toBe(false);
		expect(result.reasons).toContain("Payment account setup incomplete");
	});

	it("disallows both when not verified + not_started", () => {
		const result = getPublishingEligibility({
			isVerified: false,
			razorpayAccountStatus: "not_started",
		});

		expect(result.canPublishFreeEvents).toBe(false);
		expect(result.canPublishPaidEvents).toBe(false);
		expect(result.reasons).toContain("Organizer verification required");
		expect(result.reasons).toContain("Payment account setup incomplete");
	});

	it("disallows paid when verified + failed", () => {
		const result = getPublishingEligibility({
			isVerified: true,
			razorpayAccountStatus: "failed",
		});

		expect(result.canPublishFreeEvents).toBe(true);
		expect(result.canPublishPaidEvents).toBe(false);
		expect(result.reasons).toContain("Payment account setup incomplete");
	});

	it("disallows paid when verified + suspended", () => {
		const result = getPublishingEligibility({
			isVerified: true,
			razorpayAccountStatus: "suspended",
		});

		expect(result.canPublishFreeEvents).toBe(true);
		expect(result.canPublishPaidEvents).toBe(false);
	});

	it("disallows both when not verified even with active Razorpay", () => {
		const result = getPublishingEligibility({
			isVerified: false,
			razorpayAccountStatus: "active",
		});

		expect(result.canPublishFreeEvents).toBe(false);
		expect(result.canPublishPaidEvents).toBe(false);
		expect(result.reasons).toContain("Organizer verification required");
	});
});
