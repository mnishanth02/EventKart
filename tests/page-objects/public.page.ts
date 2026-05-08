import type { Page } from "@playwright/test";

/**
 * Page Object Model for public pages
 */
export class PublicPage {
	constructor(private page: Page) {}

	/**
	 * Navigate to home page
	 */
	async navigateToHome(): Promise<void> {
		await this.page.goto("/");
	}

	/**
	 * Navigate to event detail page
	 */
	async navigateToEventDetail(slug: string): Promise<void> {
		await this.page.goto(`/events/${slug}`);
	}

	/**
	 * Check if header is visible
	 */
	async isHeaderVisible(): Promise<boolean> {
		const header = this.page.locator("header").first();
		return header.isVisible();
	}

	/**
	 * Check if footer is visible
	 */
	async isFooterVisible(): Promise<boolean> {
		const footer = this.page.locator("footer").first();
		return footer.isVisible();
	}

	/**
	 * Toggle theme
	 */
	async toggleTheme(): Promise<void> {
		const themeToggle = this.page.getByRole("button", {
			name: /theme|dark|light mode/i,
		});
		await themeToggle.click();
	}

	/**
	 * Get current theme
	 */
	async getCurrentTheme(): Promise<"light" | "dark"> {
		const html = this.page.locator("html");
		const classList = await html.getAttribute("class");
		return classList?.includes("dark") ? "dark" : "light";
	}

	/**
	 * Check meta tag presence
	 */
	async hasMetaTag(name: string, property?: string): Promise<boolean> {
		const selector = property
			? `meta[property="${property}"]`
			: `meta[name="${name}"]`;
		const meta = this.page.locator(selector);
		return meta.count().then((count) => count > 0);
	}

	/**
	 * Get meta tag content
	 */
	async getMetaContent(name: string, property?: string): Promise<string | null> {
		const selector = property
			? `meta[property="${property}"]`
			: `meta[name="${name}"]`;
		const meta = this.page.locator(selector);
		return meta.getAttribute("content");
	}

	/**
	 * Check canonical URL
	 */
	async getCanonicalURL(): Promise<string | null> {
		const canonical = this.page.locator('link[rel="canonical"]');
		return canonical.getAttribute("href");
	}

	/**
	 * Get page title
	 */
	async getPageTitle(): Promise<string> {
		return this.page.title();
	}

	/**
	 * Navigate to a 404 page
	 */
	async navigateTo404(): Promise<void> {
		await this.page.goto("/this-route-does-not-exist-for-testing");
	}

	/**
	 * Check if 404 page is displayed
	 */
	async is404Displayed(): Promise<boolean> {
		const notFound = this.page.getByText(/not found|404/i);
		return notFound.isVisible({ timeout: 3000 }).catch(() => false);
	}
}
