import type { FastifyBaseLogger } from "fastify";
import Razorpay from "razorpay";
import type { AppConfig } from "./config.js";

export type RazorpayMode = "live" | "test" | "disabled";

export interface RazorpayClient {
	mode: RazorpayMode;
	instance: Razorpay | null;
}

/**
 * Determine Razorpay mode from config.
 * - Both keys present → "live" (or "test" based on key prefix)
 * - Missing keys → "disabled"
 */
export function getRazorpayMode(config: AppConfig): RazorpayMode {
	if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
		return "disabled";
	}
	return config.RAZORPAY_KEY_ID.startsWith("rzp_test_") ? "test" : "live";
}

export function createRazorpayClient(
	config: AppConfig,
	log: FastifyBaseLogger,
): RazorpayClient {
	const mode = getRazorpayMode(config);

	if (mode === "disabled") {
		log.warn(
			"Razorpay integration disabled — RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not configured",
		);
		return { mode, instance: null };
	}

	// Keys are guaranteed present when mode !== "disabled"
	const keyId = config.RAZORPAY_KEY_ID as string;
	const keySecret = config.RAZORPAY_KEY_SECRET as string;

	const instance = new Razorpay({
		key_id: keyId,
		key_secret: keySecret,
	});

	log.info({ mode }, "Razorpay client initialized");
	return { mode, instance };
}
