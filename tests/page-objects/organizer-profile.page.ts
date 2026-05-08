import type { Page } from "@playwright/test";

/**
 * Page Object Model for organizer profile management
 */
export class OrganizerProfilePage {
	constructor(private page: Page) {}

	/**
	 * Navigate to organizer dashboard
	 */
	async navigateToDashboard(): Promise<void> {
		await this.page.goto("/org");
	}

	/**
	 * Navigate to profile creation/edit page
	 */
	async navigateToProfile(): Promise<void> {
		await this.page.goto("/org/profile");
	}

	/**
	 * Navigate to policies page
	 */
	async navigateToPolicies(): Promise<void> {
		await this.page.goto("/org/policies");
	}

	/**
	 * Navigate to verification page
	 */
	async navigateToVerification(): Promise<void> {
		await this.page.goto("/org/verification");
	}

	/**
	 * Fill profile form
	 */
	async fillProfileForm(data: {
		businessName?: string;
		contactPersonName?: string;
		email?: string;
		phone?: string;
		address?: string;
		city?: string;
		state?: string;
		pincode?: string;
		description?: string;
	}): Promise<void> {
		if (data.businessName) {
			await this.page.getByLabel(/business name/i).fill(data.businessName);
		}
		if (data.contactPersonName) {
			await this.page
				.getByLabel(/contact person|contact name/i)
				.fill(data.contactPersonName);
		}
		if (data.email) {
			await this.page.getByLabel(/email/i).fill(data.email);
		}
		if (data.phone) {
			await this.page.getByLabel(/phone|mobile/i).fill(data.phone);
		}
		if (data.address) {
			await this.page.getByLabel(/address/i).fill(data.address);
		}
		if (data.city) {
			await this.page.getByLabel(/city/i).fill(data.city);
		}
		if (data.state) {
			await this.page.getByLabel(/state/i).fill(data.state);
		}
		if (data.pincode) {
			await this.page.getByLabel(/pincode|pin code/i).fill(data.pincode);
		}
		if (data.description) {
			await this.page.getByLabel(/description/i).fill(data.description);
		}
	}

	/**
	 * Submit profile form
	 */
	async submitProfile(): Promise<void> {
		const submitButton = this.page.getByRole("button", {
			name: /save|submit|create profile/i,
		});
		await submitButton.click();
	}

	/**
	 * Accept policy
	 */
	async acceptPolicy(policyName: string): Promise<void> {
		const checkbox = this.page.getByLabel(new RegExp(policyName, "i"));
		await checkbox.check();
	}

	/**
	 * Submit policies
	 */
	async submitPolicies(): Promise<void> {
		const submitButton = this.page.getByRole("button", {
			name: /accept|submit|agree/i,
		});
		await submitButton.click();
	}

	/**
	 * Get verification status
	 */
	async getVerificationStatus(): Promise<string> {
		const statusElement = this.page.locator('[data-testid="verification-status"]');
		return (await statusElement.textContent()) || "";
	}

	/**
	 * Check if document upload is available
	 */
	async isDocumentUploadAvailable(): Promise<boolean> {
		const uploadButton = this.page.getByRole("button", {
			name: /upload|choose file/i,
		});
		return uploadButton
			.first()
			.isVisible({ timeout: 2000 })
			.catch(() => false);
	}

	/**
	 * Check for verification badge
	 */
	async hasVerificationBadge(): Promise<boolean> {
		const badge = this.page.getByText(/verified|✓/i);
		return badge.isVisible({ timeout: 2000 }).catch(() => false);
	}
}
