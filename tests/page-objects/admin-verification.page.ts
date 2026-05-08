import type { Page } from "@playwright/test";

/**
 * Page Object Model for admin verification flows
 */
export class AdminVerificationPage {
	constructor(private page: Page) {}

	/**
	 * Navigate to verification queue
	 */
	async navigateToQueue(): Promise<void> {
		await this.page.goto("/admin/verifications");
	}

	/**
	 * Navigate to specific organizer verification detail
	 */
	async navigateToDetail(organizerId: string): Promise<void> {
		await this.page.goto(`/admin/verifications/${organizerId}`);
	}

	/**
	 * Filter by status
	 */
	async filterByStatus(status: string): Promise<void> {
		const filterSelect = this.page.getByLabel(/status|filter/i);
		await filterSelect.selectOption(status);
	}

	/**
	 * Click on first organizer in queue
	 */
	async clickFirstOrganizer(): Promise<void> {
		const firstItem = this.page.locator('[data-testid="verification-item"]').first();
		await firstItem.click();
	}

	/**
	 * Approve organizer
	 */
	async approveOrganizer(notes?: string): Promise<void> {
		const approveButton = this.page.getByRole("button", {
			name: /approve/i,
		});
		await approveButton.click();

		if (notes) {
			const notesInput = this.page.getByLabel(/notes|comments/i);
			await notesInput.fill(notes);
		}

		const confirmButton = this.page.getByRole("button", {
			name: /confirm|submit/i,
		});
		await confirmButton.click();
	}

	/**
	 * Reject organizer
	 */
	async rejectOrganizer(reason: string): Promise<void> {
		const rejectButton = this.page.getByRole("button", {
			name: /reject/i,
		});
		await rejectButton.click();

		const reasonInput = this.page.getByLabel(/reason|rejection reason/i);
		await reasonInput.fill(reason);

		const confirmButton = this.page.getByRole("button", {
			name: /confirm|submit/i,
		});
		await confirmButton.click();
	}

	/**
	 * Check if queue has items
	 */
	async hasQueueItems(): Promise<boolean> {
		const items = this.page.locator('[data-testid="verification-item"]');
		return items.count().then((count) => count > 0);
	}

	/**
	 * Get organizer status
	 */
	async getOrganizerStatus(): Promise<string> {
		const statusElement = this.page.locator('[data-testid="organizer-status"]');
		return (await statusElement.textContent()) || "";
	}
}
