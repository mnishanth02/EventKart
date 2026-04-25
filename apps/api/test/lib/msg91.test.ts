import type { FastifyBaseLogger } from "fastify";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type Msg91Config,
	sendOtpWithFallback,
	sendSmsOtp,
	sendWhatsAppOtp,
} from "../../src/lib/msg91.js";

const mockLog = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
	trace: vi.fn(),
	fatal: vi.fn(),
	child: vi.fn().mockReturnThis(),
} as unknown as FastifyBaseLogger;

const config: Msg91Config = {
	authKey: "test-auth-key-123",
	templateId: "test-template-456",
};

const SMS_URL = "https://control.msg91.com/api/v5/otp";
const WHATSAPP_URL =
	"https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

function okJsonResponse(data: Record<string, unknown>): Response {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function errorResponse(status: number, body: string): Response {
	return new Response(body, { status });
}

describe("MSG91 Client", () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.restoreAllMocks();
		mockFetch = vi.fn();
		vi.stubGlobal("fetch", mockFetch);
		vi.mocked(mockLog.info).mockClear();
		vi.mocked(mockLog.warn).mockClear();
		vi.mocked(mockLog.error).mockClear();
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	describe("sendSmsOtp", () => {
		it("returns success when API responds with success type", async () => {
			mockFetch.mockResolvedValueOnce(
				okJsonResponse({ type: "success", request_id: "abc" }),
			);

			const result = await sendSmsOtp("+919876543210", "1234", config, mockLog);

			expect(result).toEqual({ success: true, channel: "sms" });
		});

		it("sends to the correct URL", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ type: "success" }));

			await sendSmsOtp("+919876543210", "1234", config, mockLog);

			expect(mockFetch).toHaveBeenCalledOnce();
			const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(SMS_URL);
		});

		it("sends correct headers", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ type: "success" }));

			await sendSmsOtp("+919876543210", "1234", config, mockLog);

			const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
			expect(options.method).toBe("POST");
			expect(options.headers).toEqual(
				expect.objectContaining({
					"Content-Type": "application/json",
					authkey: "test-auth-key-123",
				}),
			);
		});

		it("includes templateId in body when provided", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ type: "success" }));

			await sendSmsOtp("+919876543210", "5678", config, mockLog);

			const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
			const body = JSON.parse(options.body as string) as Record<string, string>;
			expect(body).toEqual({
				mobile: "+919876543210",
				otp: "5678",
				authkey: "test-auth-key-123",
				template_id: "test-template-456",
			});
		});

		it("omits templateId from body when not in config", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ type: "success" }));

			const configNoTemplate: Msg91Config = {
				authKey: "test-auth-key-123",
			};
			await sendSmsOtp("+919876543210", "1234", configNoTemplate, mockLog);

			const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
			const body = JSON.parse(options.body as string) as Record<string, string>;
			expect(body).not.toHaveProperty("template_id");
			expect(body).toEqual({
				mobile: "+919876543210",
				otp: "1234",
				authkey: "test-auth-key-123",
			});
		});

		it("returns failure with HTTP error details on non-OK response", async () => {
			mockFetch.mockResolvedValueOnce(
				errorResponse(500, "Internal Server Error"),
			);

			const result = await sendSmsOtp("+919876543210", "1234", config, mockLog);

			expect(result).toEqual({
				success: false,
				channel: "sms",
				error: "HTTP 500: Internal Server Error",
			});
			expect(mockLog.warn).toHaveBeenCalledWith(
				{ status: 500, body: "Internal Server Error" },
				"MSG91 SMS OTP failed",
			);
		});

		it("returns failure when API responds with error type", async () => {
			mockFetch.mockResolvedValueOnce(
				okJsonResponse({ type: "error", message: "invalid" }),
			);

			const result = await sendSmsOtp("+919876543210", "1234", config, mockLog);

			expect(result).toEqual({
				success: false,
				channel: "sms",
				error: "invalid",
			});
			expect(mockLog.warn).toHaveBeenCalledWith(
				{ response: { type: "error", message: "invalid" } },
				"MSG91 SMS OTP rejected",
			);
		});

		it("returns 'Unknown MSG91 error' when error type has no message", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ type: "error" }));

			const result = await sendSmsOtp("+919876543210", "1234", config, mockLog);

			expect(result).toEqual({
				success: false,
				channel: "sms",
				error: "Unknown MSG91 error",
			});
		});

		it("returns failure on network error", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

			const result = await sendSmsOtp("+919876543210", "1234", config, mockLog);

			expect(result).toEqual({
				success: false,
				channel: "sms",
				error: "Failed to fetch",
			});
			expect(mockLog.warn).toHaveBeenCalledWith(
				{ err: expect.any(Error) },
				"MSG91 SMS OTP request failed",
			);
		});

		it("returns 'Unknown error' for non-Error thrown values", async () => {
			mockFetch.mockRejectedValueOnce("string error");

			const result = await sendSmsOtp("+919876543210", "1234", config, mockLog);

			expect(result).toEqual({
				success: false,
				channel: "sms",
				error: "Unknown error",
			});
		});
	});

	describe("sendWhatsAppOtp", () => {
		it("returns success when API responds OK", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ status: "sent" }));

			const result = await sendWhatsAppOtp(
				"+919876543210",
				"1234",
				config,
				mockLog,
			);

			expect(result).toEqual({ success: true, channel: "whatsapp" });
		});

		it("sends to the correct WhatsApp URL", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ status: "sent" }));

			await sendWhatsAppOtp("+919876543210", "1234", config, mockLog);

			const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(WHATSAPP_URL);
		});

		it("sends correct body with templateId", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ status: "sent" }));

			await sendWhatsAppOtp("+919876543210", "1234", config, mockLog);

			const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
			const body = JSON.parse(options.body as string) as Record<string, string>;
			expect(body).toEqual({
				integrated_number: "+919876543210",
				content_template_id: "test-template-456",
			});
		});

		it("uses empty string for content_template_id when templateId is missing", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ status: "sent" }));

			const configNoTemplate: Msg91Config = {
				authKey: "test-auth-key-123",
			};
			await sendWhatsAppOtp("+919876543210", "1234", configNoTemplate, mockLog);

			const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
			const body = JSON.parse(options.body as string) as Record<string, string>;
			expect(body.content_template_id).toBe("");
		});

		it("returns failure with HTTP error details on non-OK response", async () => {
			mockFetch.mockResolvedValueOnce(errorResponse(400, "Bad Request"));

			const result = await sendWhatsAppOtp(
				"+919876543210",
				"1234",
				config,
				mockLog,
			);

			expect(result).toEqual({
				success: false,
				channel: "whatsapp",
				error: "HTTP 400: Bad Request",
			});
			expect(mockLog.warn).toHaveBeenCalledWith(
				{ status: 400, body: "Bad Request" },
				"MSG91 WhatsApp OTP failed",
			);
		});

		it("returns failure on network error", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network unavailable"));

			const result = await sendWhatsAppOtp(
				"+919876543210",
				"1234",
				config,
				mockLog,
			);

			expect(result).toEqual({
				success: false,
				channel: "whatsapp",
				error: "Network unavailable",
			});
			expect(mockLog.warn).toHaveBeenCalledWith(
				{ err: expect.any(Error) },
				"MSG91 WhatsApp OTP request failed",
			);
		});

		it("returns 'Unknown error' for non-Error thrown values", async () => {
			mockFetch.mockRejectedValueOnce(42);

			const result = await sendWhatsAppOtp(
				"+919876543210",
				"1234",
				config,
				mockLog,
			);

			expect(result).toEqual({
				success: false,
				channel: "whatsapp",
				error: "Unknown error",
			});
		});
	});

	describe("sendOtpWithFallback", () => {
		it("returns SMS result when SMS succeeds", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ type: "success" }));

			const result = await sendOtpWithFallback(
				"+919876543210",
				"1234",
				config,
				mockLog,
			);

			expect(result).toEqual({ success: true, channel: "sms" });
			expect(mockFetch).toHaveBeenCalledOnce();
		});

		it("does not call WhatsApp when SMS succeeds", async () => {
			mockFetch.mockResolvedValueOnce(okJsonResponse({ type: "success" }));

			await sendOtpWithFallback("+919876543210", "1234", config, mockLog);

			expect(mockFetch).toHaveBeenCalledOnce();
			const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(SMS_URL);
		});

		it("falls back to WhatsApp when SMS fails and returns WhatsApp result", async () => {
			mockFetch
				.mockResolvedValueOnce(errorResponse(500, "SMS gateway down"))
				.mockResolvedValueOnce(okJsonResponse({ status: "sent" }));

			const result = await sendOtpWithFallback(
				"+919876543210",
				"1234",
				config,
				mockLog,
			);

			expect(result).toEqual({ success: true, channel: "whatsapp" });
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("logs fallback attempt with masked phone", async () => {
			mockFetch
				.mockResolvedValueOnce(errorResponse(500, "SMS gateway down"))
				.mockResolvedValueOnce(okJsonResponse({ status: "sent" }));

			await sendOtpWithFallback("+919876543210", "1234", config, mockLog);

			expect(mockLog.info).toHaveBeenCalledWith(
				{ phone: "+91987****" },
				"SMS OTP failed, trying WhatsApp fallback",
			);
		});

		it("returns WhatsApp failure when both SMS and WhatsApp fail", async () => {
			mockFetch
				.mockResolvedValueOnce(errorResponse(500, "SMS error"))
				.mockResolvedValueOnce(errorResponse(503, "WhatsApp error"));

			const result = await sendOtpWithFallback(
				"+919876543210",
				"1234",
				config,
				mockLog,
			);

			expect(result).toEqual({
				success: false,
				channel: "whatsapp",
				error: "HTTP 503: WhatsApp error",
			});
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("falls back to WhatsApp when SMS throws a network error", async () => {
			mockFetch
				.mockRejectedValueOnce(new Error("DNS resolution failed"))
				.mockResolvedValueOnce(okJsonResponse({ status: "sent" }));

			const result = await sendOtpWithFallback(
				"+919876543210",
				"1234",
				config,
				mockLog,
			);

			expect(result).toEqual({ success: true, channel: "whatsapp" });
		});
	});
});
