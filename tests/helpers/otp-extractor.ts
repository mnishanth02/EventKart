/**
 * Helper to extract OTP codes from API server logs
 * In development mode with OTP_DELIVERY_MODE=log, OTP codes are logged to console
 */

export class OTPExtractor {
	private static instance: OTPExtractor;
	private otpCache = new Map<string, string>();

	private constructor() {}

	static getInstance(): OTPExtractor {
		if (!OTPExtractor.instance) {
			OTPExtractor.instance = new OTPExtractor();
		}
		return OTPExtractor.instance;
	}

	/**
	 * Extract OTP from log output
	 * Expected log format: "OTP for +919999900001: 123456"
	 */
	extractOTPFromLog(logText: string, phone: string): string | null {
		// Match patterns like: OTP for +919999900001: 123456
		const otpRegex = new RegExp(`OTP for \\+91${phone}:\\s*(\\d{6})`, "i");
		const match = logText.match(otpRegex);

		if (match?.[1]) {
			return match[1];
		}

		// Alternative pattern: {"phone":"+919999900001","otp":"123456"}
		const jsonRegex = new RegExp(
			`"phone":"\\+91${phone}".*?"otp":"(\\d{6})"`,
			"i",
		);
		const jsonMatch = logText.match(jsonRegex);

		if (jsonMatch?.[1]) {
			return jsonMatch[1];
		}

		return null;
	}

	/**
	 * Cache OTP for a phone number
	 */
	cacheOTP(phone: string, otp: string): void {
		this.otpCache.set(phone, otp);
	}

	/**
	 * Get cached OTP for a phone number
	 */
	getCachedOTP(phone: string): string | undefined {
		return this.otpCache.get(phone);
	}

	/**
	 * Clear OTP cache
	 */
	clearCache(): void {
		this.otpCache.clear();
	}

	/**
	 * For testing purposes, use a known OTP
	 * This simulates extracting from logs
	 */
	mockOTP(phone: string, otp = "123456"): string {
		this.cacheOTP(phone, otp);
		return otp;
	}
}

export const otpExtractor = OTPExtractor.getInstance();
