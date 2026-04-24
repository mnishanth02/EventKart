import type { FastifyBaseLogger } from "fastify";

export interface Msg91Config {
	authKey: string;
	templateId?: string;
}

export interface OtpDeliveryResult {
	success: boolean;
	channel: "sms" | "whatsapp";
	error?: string;
}

const MSG91_BASE_URL = "https://control.msg91.com/api/v5";
const MSG91_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
	url: string,
	options: RequestInit,
	timeoutMs: number,
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function sendSmsOtp(
	phone: string,
	otp: string,
	config: Msg91Config,
	log: FastifyBaseLogger,
): Promise<OtpDeliveryResult> {
	try {
		const body: Record<string, string> = {
			mobile: phone,
			otp,
			authkey: config.authKey,
		};

		if (config.templateId) {
			body.template_id = config.templateId;
		}

		const response = await fetchWithTimeout(
			`${MSG91_BASE_URL}/otp`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authkey: config.authKey,
				},
				body: JSON.stringify(body),
			},
			MSG91_TIMEOUT_MS,
		);

		if (!response.ok) {
			const text = await response.text().catch(() => "Unknown error");
			log.warn(
				{ status: response.status, body: text },
				"MSG91 SMS OTP failed",
			);
			return {
				success: false,
				channel: "sms",
				error: `HTTP ${response.status}: ${text}`,
			};
		}

		const data = (await response.json()) as Record<string, unknown>;

		if (data.type === "error") {
			log.warn({ response: data }, "MSG91 SMS OTP rejected");
			return {
				success: false,
				channel: "sms",
				error: String(data.message ?? "Unknown MSG91 error"),
			};
		}

		return { success: true, channel: "sms" };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		log.warn({ err: error }, "MSG91 SMS OTP request failed");
		return { success: false, channel: "sms", error: message };
	}
}

export async function sendWhatsAppOtp(
	phone: string,
	otp: string,
	config: Msg91Config,
	log: FastifyBaseLogger,
): Promise<OtpDeliveryResult> {
	try {
		const body: Record<string, string> = {
			integrated_number: phone,
			content_template_id: config.templateId ?? "",
		};

		const response = await fetchWithTimeout(
			`${MSG91_BASE_URL}/whatsapp/whatsapp-outbound-message/bulk/`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authkey: config.authKey,
				},
				body: JSON.stringify(body),
			},
			MSG91_TIMEOUT_MS,
		);

		if (!response.ok) {
			const text = await response.text().catch(() => "Unknown error");
			log.warn(
				{ status: response.status, body: text },
				"MSG91 WhatsApp OTP failed",
			);
			return {
				success: false,
				channel: "whatsapp",
				error: `HTTP ${response.status}: ${text}`,
			};
		}

		return { success: true, channel: "whatsapp" };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error";
		log.warn({ err: error }, "MSG91 WhatsApp OTP request failed");
		return { success: false, channel: "whatsapp", error: message };
	}
}

export async function sendOtpWithFallback(
	phone: string,
	otp: string,
	config: Msg91Config,
	log: FastifyBaseLogger,
): Promise<OtpDeliveryResult> {
	const smsResult = await sendSmsOtp(phone, otp, config, log);

	if (smsResult.success) {
		return smsResult;
	}

	log.info(
		{ phone: phone.slice(0, 6) + "****" },
		"SMS OTP failed, trying WhatsApp fallback",
	);
	return sendWhatsAppOtp(phone, otp, config, log);
}
