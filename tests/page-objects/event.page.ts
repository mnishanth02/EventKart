import type { Page } from "@playwright/test";

/**
 * Page Object Model for event management flows
 */
export class EventPage {
	constructor(private page: Page) {}

	/**
	 * Navigate to event creation page
	 */
	async navigateToCreate(): Promise<void> {
		await this.page.goto("/org/events/new");
	}

	/**
	 * Navigate to event edit page
	 */
	async navigateToEdit(eventId: string): Promise<void> {
		await this.page.goto(`/org/events/${eventId}/edit`);
	}

	/**
	 * Fill basic event information
	 */
	async fillBasicInfo(data: {
		name?: string;
		description?: string;
		eventDate?: string;
		startTime?: string;
		location?: string;
		city?: string;
	}): Promise<void> {
		if (data.name) {
			await this.page.getByLabel(/event name|name/i).fill(data.name);
		}
		if (data.description) {
			await this.page.getByLabel(/description/i).fill(data.description);
		}
		if (data.eventDate) {
			await this.page.getByLabel(/event date|date/i).fill(data.eventDate);
		}
		if (data.startTime) {
			await this.page.getByLabel(/start time|time/i).fill(data.startTime);
		}
		if (data.location) {
			await this.page.getByLabel(/location|venue/i).fill(data.location);
		}
		if (data.city) {
			await this.page.getByLabel(/city/i).fill(data.city);
		}
	}

	/**
	 * Submit event form
	 */
	async submitEvent(): Promise<void> {
		const submitButton = this.page.getByRole("button", {
			name: /save|create|submit/i,
		});
		await submitButton.click();
	}

	/**
	 * Navigate to category configuration
	 */
	async navigateToCategoryConfig(eventId: string): Promise<void> {
		await this.page.goto(`/org/events/${eventId}/configure-categories`);
	}

	/**
	 * Navigate to pricing configuration
	 */
	async navigateToPricingConfig(eventId: string): Promise<void> {
		await this.page.goto(`/org/events/${eventId}/configure-pricing`);
	}

	/**
	 * Publish event
	 */
	async publishEvent(): Promise<void> {
		const publishButton = this.page.getByRole("button", {
			name: /publish/i,
		});
		await publishButton.click();

		// Confirm if dialog appears
		const confirmButton = this.page.getByRole("button", {
			name: /confirm|yes|publish/i,
		});
		const isVisible = await confirmButton
			.isVisible({ timeout: 2000 })
			.catch(() => false);

		if (isVisible) {
			await confirmButton.click();
		}
	}

	/**
	 * Unpublish event
	 */
	async unpublishEvent(): Promise<void> {
		const unpublishButton = this.page.getByRole("button", {
			name: /unpublish/i,
		});
		await unpublishButton.click();

		// Confirm if dialog appears
		const confirmButton = this.page.getByRole("button", {
			name: /confirm|yes|unpublish/i,
		});
		const isVisible = await confirmButton
			.isVisible({ timeout: 2000 })
			.catch(() => false);

		if (isVisible) {
			await confirmButton.click();
		}
	}

	/**
	 * Check publish readiness
	 */
	async getPublishReadiness(): Promise<string[]> {
		const checklist = this.page.locator('[data-testid="publish-checklist"] li');
		const count = await checklist.count();
		const items: string[] = [];

		for (let i = 0; i < count; i++) {
			const text = await checklist.nth(i).textContent();
			if (text) items.push(text);
		}

		return items;
	}

	/**
	 * Get event status
	 */
	async getEventStatus(): Promise<string> {
		const statusElement = this.page.locator('[data-testid="event-status"]');
		return (await statusElement.textContent()) || "";
	}
}
