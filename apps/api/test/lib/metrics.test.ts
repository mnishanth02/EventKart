import { describe, it, expect } from "vitest";

import {
	httpRequestDuration,
	httpRequestTotal,
	otpSendTotal,
	otpVerifyTotal,
	funnelStepTotal,
	bookingCreateDuration,
	bookingCreateTotal,
	paymentOrderDuration,
	paymentOrderTotal,
	paymentConfirmDuration,
	webhookAckDuration,
	webhookProcessDuration,
	queueDepth,
	queueOldestJobAge,
	queueDelayedJobs,
	queueFailedJobs,
	queueDlqDepth,
	dbSlowQueryTotal,
	dbQueryDuration,
	redisMemoryUsage,
	redisEvictedKeys,
	redisConnectedClients,
	emailSendTotal,
} from "../../src/lib/metrics.js";

describe("metrics instrument registry", () => {
	it("exports HTTP metric instruments", () => {
		expect(httpRequestDuration).toBeDefined();
		expect(typeof httpRequestDuration.record).toBe("function");
		expect(httpRequestTotal).toBeDefined();
		expect(typeof httpRequestTotal.add).toBe("function");
	});

	it("exports auth/OTP metric instruments", () => {
		expect(otpSendTotal).toBeDefined();
		expect(typeof otpSendTotal.add).toBe("function");
		expect(otpVerifyTotal).toBeDefined();
		expect(typeof otpVerifyTotal.add).toBe("function");
	});

	it("exports conversion funnel instrument", () => {
		expect(funnelStepTotal).toBeDefined();
		expect(typeof funnelStepTotal.add).toBe("function");
	});

	it("exports booking metric instruments (future)", () => {
		expect(bookingCreateDuration).toBeDefined();
		expect(typeof bookingCreateDuration.record).toBe("function");
		expect(bookingCreateTotal).toBeDefined();
		expect(typeof bookingCreateTotal.add).toBe("function");
	});

	it("exports payment metric instruments (future)", () => {
		expect(paymentOrderDuration).toBeDefined();
		expect(paymentOrderTotal).toBeDefined();
		expect(paymentConfirmDuration).toBeDefined();
	});

	it("exports webhook metric instruments (future)", () => {
		expect(webhookAckDuration).toBeDefined();
		expect(webhookProcessDuration).toBeDefined();
	});

	it("exports queue metric instruments", () => {
		expect(queueDepth).toBeDefined();
		expect(typeof queueDepth.addCallback).toBe("function");
		expect(queueOldestJobAge).toBeDefined();
		expect(queueDelayedJobs).toBeDefined();
		expect(typeof queueDelayedJobs.addCallback).toBe("function");
		expect(queueFailedJobs).toBeDefined();
		expect(typeof queueFailedJobs.addCallback).toBe("function");
		expect(queueDlqDepth).toBeDefined();
		expect(typeof queueDlqDepth.addCallback).toBe("function");
	});

	it("exports database metric instruments", () => {
		expect(dbSlowQueryTotal).toBeDefined();
		expect(dbQueryDuration).toBeDefined();
	});

	it("exports Redis metric instruments", () => {
		expect(redisMemoryUsage).toBeDefined();
		expect(typeof redisMemoryUsage.addCallback).toBe("function");
		expect(redisEvictedKeys).toBeDefined();
		expect(redisConnectedClients).toBeDefined();
	});

	it("exports email metric instruments (future)", () => {
		expect(emailSendTotal).toBeDefined();
		expect(typeof emailSendTotal.add).toBe("function");
	});

	it("instruments are callable without errors (no-op in tests)", () => {
		// Counters
		expect(() => httpRequestTotal.add(1, { method: "GET", route: "/health", status: "200" })).not.toThrow();
		expect(() => otpSendTotal.add(1, { status: "success" })).not.toThrow();
		expect(() => otpVerifyTotal.add(1, { status: "success" })).not.toThrow();
		expect(() => funnelStepTotal.add(1, { step: "otp_sent" })).not.toThrow();

		// Histograms
		expect(() => httpRequestDuration.record(42, { method: "GET", route: "/health", status: "200" })).not.toThrow();
	});
});
