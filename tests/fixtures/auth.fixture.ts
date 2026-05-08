import { test as base } from "@playwright/test";
import { AuthPage } from "../page-objects/auth.page";
import { PublicPage } from "../page-objects/public.page";
import { OrganizerProfilePage } from "../page-objects/organizer-profile.page";
import { AdminVerificationPage } from "../page-objects/admin-verification.page";
import { EventPage } from "../page-objects/event.page";
import { TEST_USERS } from "../helpers/test-users";
import { apiClient } from "../helpers/api-client";

/**
 * Extended test fixtures with page objects and authentication helpers
 */
type TestFixtures = {
	authPage: AuthPage;
	publicPage: PublicPage;
	organizerProfilePage: OrganizerProfilePage;
	adminVerificationPage: AdminVerificationPage;
	eventPage: EventPage;
	apiClient: typeof apiClient;
	authenticatedAsOrganizer: void;
	authenticatedAsAdmin: void;
	authenticatedAsParticipant: void;
};

export const test = base.extend<TestFixtures>({
	// Page object fixtures
	authPage: async ({ page }, use) => {
		await use(new AuthPage(page));
	},

	publicPage: async ({ page }, use) => {
		await use(new PublicPage(page));
	},

	organizerProfilePage: async ({ page }, use) => {
		await use(new OrganizerProfilePage(page));
	},

	adminVerificationPage: async ({ page }, use) => {
		await use(new AdminVerificationPage(page));
	},

	eventPage: async ({ page }, use) => {
		await use(new EventPage(page));
	},

	// API client fixture
	apiClient: async ({}, use) => {
		await use(apiClient);
	},

	// Auto-authentication fixtures
	authenticatedAsOrganizer: async ({ page }, use) => {
		const authPage = new AuthPage(page);
		await page.goto("/org");
		await authPage.login(TEST_USERS.organizer.phone);
		await use();
	},

	authenticatedAsAdmin: async ({ page }, use) => {
		const authPage = new AuthPage(page);
		await page.goto("/admin");
		await authPage.login(TEST_USERS.admin.phone);
		await use();
	},

	authenticatedAsParticipant: async ({ page }, use) => {
		const authPage = new AuthPage(page);
		await page.goto("/my");
		await authPage.login(TEST_USERS.participant.phone);
		await use();
	},
});

export { expect } from "@playwright/test";
