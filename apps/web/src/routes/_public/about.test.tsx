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

vi.mock("#/features/legal-pages/cache-headers", () => ({
	LEGAL_PAGE_CACHE_CONTROL: "public, s-maxage=3600, stale-while-revalidate=86400",
	setLegalPageCacheHeaders: vi.fn(async () => {}),
}));

import { AboutContent } from "./about";
import { LegalPageLayout } from "#/features/legal-pages/components/legal-page-layout";

afterEach(() => {
	cleanup();
});

function renderAboutPage() {
	return render(
		<LegalPageLayout title="About EventKart">
			<AboutContent />
		</LegalPageLayout>,
	);
}

describe("AboutPage (I-2.5.4)", () => {
	it("renders the H1 'About EventKart'", () => {
		renderAboutPage();
		const h1 = screen.getByRole("heading", { level: 1, name: "About EventKart" });
		expect(h1).toBeDefined();
	});

	it("renders all six section headings", () => {
		renderAboutPage();
		const expected: Array<string | RegExp> = [
			/^our mission$/i,
			/^what eventkart is$/i,
			/^who we serve$/i,
			/coimbatore pilot/i,
			/^from the team$/i,
			/^what eventkart is not$/i,
		];
		for (const pattern of expected) {
			expect(
				screen.getByRole("heading", { level: 2, name: pattern }),
			).toBeDefined();
		}
	});

	it("includes the verbatim organizer-mission phrase 'professional-grade tooling'", () => {
		renderAboutPage();
		expect(screen.getByText(/professional-grade tooling/i)).toBeDefined();
	});

	it("includes the verbatim participant-mission phrase 'reusable event identity'", () => {
		renderAboutPage();
		expect(screen.getByText(/reusable event identity/i)).toBeDefined();
	});

	it("renders all six 'What EventKart is not' boundary items", () => {
		renderAboutPage();
		expect(screen.getByText(/wedding/i)).toBeDefined();
		expect(screen.getByText(/marketplace/i)).toBeDefined();
		expect(screen.getByText(/travel or hotel/i)).toBeDefined();
		expect(screen.getByText(/GPS tracking/i)).toBeDefined();
		expect(screen.getByText(/white-label/i)).toBeDefined();
		expect(screen.getByText(/social fitness/i)).toBeDefined();
	});

	it("links to /contact at least once", () => {
		const { container } = renderAboutPage();
		const contactLinks = container.querySelectorAll('a[href="/contact"]');
		expect(contactLinks.length).toBeGreaterThanOrEqual(1);
	});

	it("does NOT render a 'Version' line (page is not a versioned legal doc)", () => {
		renderAboutPage();
		expect(screen.queryByText(/Version /)).toBeNull();
		expect(screen.queryByText(/Last updated /)).toBeNull();
	});
});
