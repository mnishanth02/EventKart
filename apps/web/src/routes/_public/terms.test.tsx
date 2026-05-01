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

import { TermsContent } from "./terms";

afterEach(() => {
	cleanup();
});

describe("TermsContent", () => {
	it("renders the page title as an <h1>", () => {
		render(<TermsContent />);
		const heading = screen.getByRole("heading", {
			level: 1,
			name: "Terms of Service",
		});
		expect(heading).toBeDefined();
	});

	it("renders the version + last-updated metadata line", () => {
		render(<TermsContent />);
		const meta = screen.getByText(/Version 1\.0.*Last updated 2026-05-01/);
		expect(meta).toBeDefined();
	});

	it.each([
		[1, /acceptance of terms/i],
		[2, /eligibility/i],
		[3, /account .* identity/i],
		[4, /booking, payment, and fees/i],
		[5, /refund and cancellation framework/i],
		[6, /organizer responsibilities/i],
		[7, /acceptable use/i],
		[8, /disclaimer .* liability boundaries/i],
		[9, /changes to terms/i],
		[10, /governing law/i],
	])("renders section heading #%i (%s)", (_index, pattern) => {
		render(<TermsContent />);
		const heading = screen.getByRole("heading", { level: 2, name: pattern });
		expect(heading).toBeDefined();
	});

	it("includes the verbatim verification disclaimer copy guard", () => {
		const { container } = render(<TermsContent />);
		expect(container.textContent ?? "").toContain(
			"Verification must be explained as a EventKart onboarding and policy check, not a blanket guarantee of event quality or safety",
		);
	});

	it("renders a mailto: link to support@eventkart.run", () => {
		const { container } = render(<TermsContent />);
		const mailto = container.querySelector(
			'a[href="mailto:support@eventkart.run"]',
		);
		expect(mailto).not.toBeNull();
	});

	it("links to /privacy and /contact", () => {
		const { container } = render(<TermsContent />);
		expect(container.querySelector('a[href="/privacy"]')).not.toBeNull();
		expect(container.querySelector('a[href="/contact"]')).not.toBeNull();
	});
});
