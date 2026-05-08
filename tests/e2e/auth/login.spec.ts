import { test, expect } from "../../fixtures/auth.fixture";
import { TEST_USERS } from "../../helpers/test-users";

/**
 * Authentication and Session Tests
 * Validates Section 7.2 of local-ui-validation-guide.md
 */

test.describe("Authentication and Session", () => {
	test("should show login prompt when accessing protected route", async ({
		page,
		authPage,
	}) => {
		await authPage.navigateToProtectedRoute("/org");

		// Should see phone input or login prompt
		const phoneInput = page.locator('input[type="tel"]');
		await expect(phoneInput).toBeVisible({ timeout: 10000 });
	});

	test("should complete OTP login flow for organizer", async ({
		page,
		authPage,
	}) => {
		await page.goto("/org");
		await authPage.login(TEST_USERS.organizer.phone);

		// Should be redirected to organizer dashboard
		await expect(page).toHaveURL(/\/org/, { timeout: 10000 });

		// Should show authenticated state
		const isAuth = await authPage.isAuthenticated();
		expect(isAuth).toBe(true);
	});

	test("should persist session after page refresh", async ({
		page,
		authPage,
	}) => {
		await page.goto("/org");
		await authPage.login(TEST_USERS.organizer.phone);

		// Wait for authentication
		await page.waitForURL(/\/org/, { timeout: 10000 });

		// Refresh the page
		await page.reload();

		// Should still be authenticated
		await page.waitForURL(/\/org/, { timeout: 10000 });
		const isAuth = await authPage.isAuthenticated();
		expect(isAuth).toBe(true);
	});

	test("should allow logout and clear session", async ({ page, authPage }) => {
		await page.goto("/org");
		await authPage.login(TEST_USERS.organizer.phone);
		await page.waitForURL(/\/org/, { timeout: 10000 });

		// Logout
		await authPage.logout();

		// Should be redirected to home page
		await expect(page).toHaveURL("/", { timeout: 5000 });

		// Trying to access protected route should show login again
		await page.goto("/org");
		const phoneInput = page.locator('input[type="tel"]');
		await expect(phoneInput).toBeVisible({ timeout: 10000 });
	});

	test("should enforce role-based access for admin", async ({
		page,
		authPage,
	}) => {
		await page.goto("/admin");
		await authPage.login(TEST_USERS.admin.phone);

		// Admin should be able to access /admin
		await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
	});

	test("should enforce role-based access for organizer", async ({
		page,
		authPage,
	}) => {
		await page.goto("/org");
		await authPage.login(TEST_USERS.organizer.phone);

		// Organizer should be able to access /org
		await expect(page).toHaveURL(/\/org/, { timeout: 10000 });
	});

	test("should enforce role-based access for participant", async ({
		page,
		authPage,
	}) => {
		await page.goto("/my");
		await authPage.login(TEST_USERS.participant.phone);

		// Participant should be able to access /my
		await expect(page).toHaveURL(/\/my/, { timeout: 10000 });
	});

	test("should block participant from accessing organizer routes", async ({
		page,
		authPage,
	}) => {
		// Login as participant
		await page.goto("/my");
		await authPage.login(TEST_USERS.participant.phone);
		await page.waitForURL(/\/my/, { timeout: 10000 });

		// Try to access organizer route
		await page.goto("/org");

		// Should be redirected or see access denied
		// Wait a moment for redirect
		await page.waitForTimeout(2000);

		const currentURL = page.url();
		expect(currentURL).not.toContain("/org");
	});

	test("should block participant from accessing admin routes", async ({
		page,
		authPage,
	}) => {
		// Login as participant
		await page.goto("/my");
		await authPage.login(TEST_USERS.participant.phone);
		await page.waitForURL(/\/my/, { timeout: 10000 });

		// Try to access admin route
		await page.goto("/admin");

		// Should be redirected or see access denied
		await page.waitForTimeout(2000);

		const currentURL = page.url();
		expect(currentURL).not.toContain("/admin");
	});
});
