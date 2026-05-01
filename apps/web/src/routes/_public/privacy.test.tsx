import { cleanup, render, screen, within } from "@testing-library/react";
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
	LEGAL_PAGE_CACHE_CONTROL:
		"public, s-maxage=3600, stale-while-revalidate=86400",
	setLegalPageCacheHeaders: vi.fn(async () => {}),
}));

import { PrivacyPage } from "./privacy";

afterEach(() => {
	cleanup();
});

describe("PrivacyPage", () => {
	it("renders the H1, version, and last-updated metadata", () => {
		render(<PrivacyPage />);
		expect(
			screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
		).toBeDefined();
		expect(
			screen.getByText(/Version 1\.0.*Last updated 2026-05-01/),
		).toBeDefined();
	});

	it("renders the data-classes table with the four participant rows", () => {
		const { container } = render(<PrivacyPage />);
		const table = container.querySelector("table");
		expect(table).not.toBeNull();
		if (!table) return;

		const headers = within(table)
			.getAllByRole("columnheader")
			.map((th) => th.textContent?.trim().toLowerCase() ?? "");
		expect(headers).toEqual([
			"data class",
			"examples",
			"access",
			"retention",
		]);

		const bodyRows = table.querySelectorAll("tbody tr");
		const rowLabels = Array.from(bodyRows).map(
			(tr) => tr.querySelector("td")?.textContent?.trim() ?? "",
		);
		expect(rowLabels).toEqual([
			"Participant profile",
			"Booking data",
			"Sensitive participant fields",
			"Payment data",
		]);
	});

	it("exposes a mailto DSAR link with a prefilled subject in the rights section", () => {
		render(<PrivacyPage />);
		const link = screen
			.getAllByRole("link")
			.find((a) =>
				(a.getAttribute("href") ?? "").startsWith(
					"mailto:support@eventkart.run",
				),
			);
		expect(link).toBeDefined();
		const href = link?.getAttribute("href") ?? "";
		expect(href).toContain("subject=");
	});

	it("states the no-pre-checked-boxes consent rule verbatim", () => {
		render(<PrivacyPage />);
		expect(screen.getAllByText(/no pre-checked boxes/i).length).toBeGreaterThan(
			0,
		);
	});
});
