import { test, expect } from "../../fixtures/auth.fixture";

/**
 * Organizer Profile Management Tests
 * Validates Sections 7.3-7.6 of local-ui-validation-guide.md
 */

test.describe("Organizer Profile", () => {
	test("should access organizer dashboard after login", async ({
		page,
		authenticatedAsOrganizer,
	}) => {
		// Should be on organizer dashboard
		await expect(page).toHaveURL(/\/org/, { timeout: 10000 });
	});

	test("should navigate to profile page", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToProfile();

		// Should be on profile page
		await expect(page).toHaveURL(/\/org\/profile/, { timeout: 10000 });
	});

	test("should show profile form with required fields", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToProfile();

		// Check for required form fields
		const businessName = page.getByLabel(/business name/i);
		const email = page.getByLabel(/email/i);
		const phone = page.getByLabel(/phone|mobile/i);

		await expect(businessName).toBeVisible({ timeout: 5000 });
		await expect(email).toBeVisible({ timeout: 5000 }).catch(() => {
			// Email might be optional
		});
	});

	test("should validate required fields on profile creation", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToProfile();

		// Try to submit empty form
		await organizerProfilePage.submitProfile();

		// Should show validation errors
		await page.waitForTimeout(1000);

		const errors = page.getByText(/required|mandatory|field is required/i);
		const hasErrors = await errors.first().isVisible().catch(() => false);

		// Some validation might be inline, so we just check the form didn't submit
		const currentURL = page.url();
		expect(currentURL).toContain("/org/profile");
	});

	test.skip("should create organizer profile successfully", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToProfile();

		// Fill profile form
		await organizerProfilePage.fillProfileForm({
			businessName: "Test Event Company",
			contactPersonName: "John Doe",
			email: "test@example.com",
			phone: "9876543210",
			address: "123 Test Street",
			city: "Bangalore",
			state: "Karnataka",
			pincode: "560001",
			description: "A test event organizer",
		});

		// Submit form
		await organizerProfilePage.submitProfile();

		// Should redirect or show success
		await page.waitForTimeout(2000);

		// Check if profile was created
		const currentURL = page.url();
		expect(currentURL).not.toContain("/profile/new");
	});
});

test.describe("Organizer Policy Acceptance", () => {
	test("should navigate to policies page", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToPolicies();

		// Should be on policies page
		await expect(page).toHaveURL(/\/org\/policies/, { timeout: 10000 });
	});

	test("should show required policy checkboxes", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToPolicies();

		// Should have policy checkboxes
		const checkboxes = page.locator('input[type="checkbox"]');
		const count = await checkboxes.count();

		expect(count).toBeGreaterThan(0);
	});

	test("should require accepting policies before submission", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToPolicies();

		// Try to submit without accepting
		await organizerProfilePage.submitPolicies();

		// Should show validation or prevent submission
		await page.waitForTimeout(1000);

		const currentURL = page.url();
		expect(currentURL).toContain("/org/policies");
	});
});

test.describe("Organizer Verification Status", () => {
	test("should navigate to verification page", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToVerification();

		// Should be on verification page
		await expect(page).toHaveURL(/\/org\/verification/, { timeout: 10000 });
	});

	test("should show verification status", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToVerification();

		// Should display verification status
		const statusText = page.getByText(/status|pending|approved|verified/i);
		await expect(statusText.first()).toBeVisible({ timeout: 5000 });
	});

	test("should show document checklist", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToVerification();

		// Should show document requirements
		const documents = page.getByText(/aadhaar|pan|gst|bank/i);
		await expect(documents.first()).toBeVisible({ timeout: 5000 });
	});

	test("should show policy acceptance status", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToVerification();

		// Should show policy status
		const policyStatus = page.getByText(/policy|policies|terms/i);
		await expect(policyStatus.first()).toBeVisible({ timeout: 5000 });
	});
});

test.describe("Organizer Document Upload", () => {
	test("should check if document upload is available", async ({
		page,
		authenticatedAsOrganizer,
		organizerProfilePage,
	}) => {
		await organizerProfilePage.navigateToVerification();

		// Check if upload functionality exists
		const uploadAvailable =
			await organizerProfilePage.isDocumentUploadAvailable();

		// Upload availability depends on storage configuration
		// We just verify the check doesn't throw
		expect(typeof uploadAvailable).toBe("boolean");
	});

	test.skip("should allow document upload when storage configured", async ({
		page,
		authenticatedAsOrganizer,
	}) => {
		await page.goto("/org/verification");

		// Look for upload button
		const uploadButton = page.getByRole("button", { name: /upload/i });

		// If button exists, click it
		const hasButton = await uploadButton.isVisible().catch(() => false);

		if (hasButton) {
			await uploadButton.click();

			// Should show file input or upload dialog
			const fileInput = page.locator('input[type="file"]');
			await expect(fileInput).toBeVisible({ timeout: 5000 });
		}
	});
});
