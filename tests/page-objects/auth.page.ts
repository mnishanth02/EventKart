import type { Page } from "@playwright/test";
import { otpExtractor } from "../helpers/otp-extractor";

/**
 * Page Object Model for authentication flows
 */
export class AuthPage {
	constructor(private page: Page) {}

	/**
	 * Navigate to a protected route that will trigger auth redirect
	 */
	async navigateToProtectedRoute(route = "/org"): Promise<void> {
		await this.page.goto(route);
	}

	/**
	 * Enter phone number in the login form
	 */
	async enterPhoneNumber(phone: string): Promise<void> {
		const phoneInput = this.page.locator('input[type="tel"]').first();
		await phoneInput.fill(phone);
	}

	/**
	 * Click send OTP button
	 */
	async clickSendOTP(): Promise<void> {
		const sendButton = this.page.getByRole("button", {
			name: /send otp|get otp/i,
		});
		await sendButton.click();
	}

	/**
	 * Enter OTP code
	 */
	async enterOTP(otp: string): Promise<void> {
		// Wait for OTP input field to appear
		const otpInput = this.page.locator('input[type="text"]').first();
		await otpInput.waitFor({ state: "visible" });
		await otpInput.fill(otp);
	}

	/**
	 * Click verify OTP button
	 */
	async clickVerifyOTP(): Promise<void> {
		const verifyButton = this.page.getByRole("button", {
			name: /verify|submit|continue/i,
		});
		await verifyButton.click();
	}

	/**
	 * Complete full login flow
	 * Note: In test environment with OTP_DELIVERY_MODE=log, we use a mock OTP
	 */
	async login(phone: string, otp = "123456"): Promise<void> {
		await this.enterPhoneNumber(phone);
		await this.clickSendOTP();

		// Wait for OTP input to appear
		await this.page.waitForTimeout(1000);

		// In tests, use mock OTP or extract from logs
		const testOTP = otpExtractor.mockOTP(phone, otp);
		await this.enterOTP(testOTP);
		await this.clickVerifyOTP();

		// Wait for successful authentication
		await this.page.waitForURL(/\/(org|admin|my)/, { timeout: 10000 });
	}

	/**
	 * Logout
	 */
	async logout(): Promise<void> {
		// Look for logout button in header or user menu
		const logoutButton = this.page.getByRole("button", { name: /logout|sign out/i });
		await logoutButton.click();

		// Wait for redirect to home page
		await this.page.waitForURL("/", { timeout: 5000 });
	}

	/**
	 * Check if user is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		// Check for presence of user menu or logout button
		const logoutButton = this.page.getByRole("button", {
			name: /logout|sign out/i,
		});
		return logoutButton.isVisible({ timeout: 2000 }).catch(() => false);
	}

	/**
	 * Wait for authentication to complete
	 */
	async waitForAuth(): Promise<void> {
		await this.page.waitForURL(/\/(org|admin|my)/, { timeout: 10000 });
	}
}
