import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to} data-testid="router-link">
			{children}
		</a>
	),
}));

import { SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS } from "#/features/legal-pages/constants";
import { LegalPageLayout } from "#/features/legal-pages/components/legal-page-layout";
import { ContactContent } from "./contact";

afterEach(() => {
	cleanup();
});

function renderContact(supportPhone: string | null) {
	return render(
		<LegalPageLayout title="Contact us">
			<ContactContent supportPhone={supportPhone} />
		</LegalPageLayout>,
	);
}

describe("ContactContent", () => {
	it("renders the H1 from the layout", () => {
		renderContact(null);
		const heading = screen.getByRole("heading", {
			level: 1,
			name: "Contact us",
		});
		expect(heading).toBeDefined();
	});

	it("renders the support email as a mailto link", () => {
		const { container } = renderContact(null);
		const link = container.querySelector(
			'a[href="mailto:support@eventkart.run"]',
		);
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("support@eventkart.run");
	});

	it("shows the 'coming soon' fallback and no tel: link when phone is null", () => {
		const { container } = renderContact(null);
		expect(screen.queryByText(/coming soon/i)).not.toBeNull();
		expect(container.querySelector('a[href^="tel:"]')).toBeNull();
	});

	it("renders a tel: link with whitespace stripped when phone is provided", () => {
		const { container } = renderContact("+91 80000 00000");
		const tel = container.querySelector('a[href^="tel:"]');
		expect(tel).not.toBeNull();
		expect(tel?.getAttribute("href")).toBe("tel:+918000000000");
		expect(tel?.textContent).toBe("+91 80000 00000");
	});

	it("includes the SLA copy sourced from the constant", () => {
		expect(SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS).toBe(2);
		renderContact(null);
		const matches = screen.getAllByText(/2 business days/);
		expect(matches.length).toBeGreaterThan(0);
	});

	it("renders exactly four items in the 'What to include' checklist", () => {
		const { container } = renderContact(null);
		const lists = container.querySelectorAll("ul");
		const checklist = Array.from(lists).find(
			(ul) => ul.querySelectorAll("li").length === 4,
		);
		expect(checklist).toBeDefined();
		expect(checklist?.querySelectorAll("li").length).toBe(4);
	});

	it("includes the placeholder copy guard for the I-7.2.5 dispute form", () => {
		renderContact(null);
		expect(
			screen.queryByText(/dispute reporting form will be added/i),
		).not.toBeNull();
	});

	it("links to /terms", () => {
		const { container } = renderContact(null);
		const termsLink = container.querySelector('a[href="/terms"]');
		expect(termsLink).not.toBeNull();
	});
});
