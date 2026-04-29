import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests/e2e",
	/* Run tests in files in parallel */
	fullyParallel: false,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : 1,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: process.env.CI
		? [["html"], ["junit", { outputFile: "test-results/junit.xml" }], ["list"]]
		: [["html"], ["list"]],
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: process.env.TEST_WEB_URL || "http://localhost:3000",

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "on-first-retry",

		/* Screenshot on failure */
		screenshot: "only-on-failure",

		/* Video on failure */
		video: "retain-on-failure",

		/* Timeout for each action */
		actionTimeout: 15000,
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},

		// Mobile tests
		{
			name: "mobile-chrome",
			use: { ...devices["Pixel 5"] },
		},
	],

	/* Global timeout for each test */
	timeout: 60000,

	/* Timeout for expect assertions */
	expect: {
		timeout: 10000,
	},

	/* Run your local dev server before starting the tests */
	// Note: In CI or when running tests, ensure API and Web servers are already running
	// webServer: [
	//   {
	//     command: 'pnpm --filter api dev',
	//     url: 'http://localhost:3001/health',
	//     reuseExistingServer: !process.env.CI,
	//     timeout: 120000,
	//   },
	//   {
	//     command: 'pnpm --filter web dev',
	//     url: 'http://localhost:3000/health',
	//     reuseExistingServer: !process.env.CI,
	//     timeout: 120000,
	//   },
	// ],
});
