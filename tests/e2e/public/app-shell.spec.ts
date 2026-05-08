import { test, expect } from "../../fixtures/auth.fixture";

/**
 * Public App Shell Tests
 * Validates Section 7.1 of local-ui-validation-guide.md
 */

test.describe("Public App Shell", () => {
	test("should load home page successfully", async ({ page, publicPage }) => {
		await publicPage.navigateToHome();

		// Page should load
		await expect(page).toHaveURL("/");

		// Should have a title
		const title = await publicPage.getPageTitle();
		expect(title).toBeTruthy();
		expect(title.length).toBeGreaterThan(0);
	});

	test("should render header correctly", async ({ page, publicPage }) => {
		await publicPage.navigateToHome();

		// Header should be visible
		const headerVisible = await publicPage.isHeaderVisible();
		expect(headerVisible).toBe(true);

		// Header should contain navigation or logo
		const header = page.locator("header");
		await expect(header).toBeVisible();
	});

	test("should render footer correctly", async ({ page, publicPage }) => {
		await publicPage.navigateToHome();

		// Footer should be visible
		const footerVisible = await publicPage.isFooterVisible();
		expect(footerVisible).toBe(true);

		// Footer should be at bottom
		const footer = page.locator("footer");
		await expect(footer).toBeVisible();
	});

	test("should toggle theme between light and dark", async ({
		page,
		publicPage,
	}) => {
		await publicPage.navigateToHome();

		// Get initial theme
		const initialTheme = await publicPage.getCurrentTheme();

		// Toggle theme
		await publicPage.toggleTheme();

		// Wait for theme to change
		await page.waitForTimeout(500);

		// Get new theme
		const newTheme = await publicPage.getCurrentTheme();

		// Theme should have changed
		expect(newTheme).not.toBe(initialTheme);
	});

	test("should show 404 page for unknown routes", async ({
		page,
		publicPage,
	}) => {
		await publicPage.navigateTo404();

		// Should show 404 content
		const is404 = await publicPage.is404Displayed();
		expect(is404).toBe(true);
	});

	test("should redirect unauthenticated users from /org", async ({
		page,
	}) => {
		await page.goto("/org");

		// Should redirect to home or show login
		await page.waitForTimeout(2000);

		const currentURL = page.url();
		const hasPhoneInput = await page
			.locator('input[type="tel"]')
			.isVisible()
			.catch(() => false);

		// Either redirected to home or showing login
		expect(currentURL === "/" || hasPhoneInput).toBe(true);
	});

	test("should redirect unauthenticated users from /admin", async ({
		page,
	}) => {
		await page.goto("/admin");

		// Should redirect to home or show login
		await page.waitForTimeout(2000);

		const currentURL = page.url();
		const hasPhoneInput = await page
			.locator('input[type="tel"]')
			.isVisible()
			.catch(() => false);

		// Either redirected to home or showing login
		expect(currentURL === "/" || hasPhoneInput).toBe(true);
	});

	test("should redirect unauthenticated users from /my", async ({ page }) => {
		await page.goto("/my");

		// Should redirect to home or show login
		await page.waitForTimeout(2000);

		const currentURL = page.url();
		const hasPhoneInput = await page
			.locator('input[type="tel"]')
			.isVisible()
			.catch(() => false);

		// Either redirected to home or showing login
		expect(currentURL === "/" || hasPhoneInput).toBe(true);
	});
});
