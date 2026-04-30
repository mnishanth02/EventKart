import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
	Link: ({
		children,
		to,
		params,
	}: {
		children: ReactNode;
		to: string;
		params?: Record<string, string>;
	}) => {
		let href = to;
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				href = href.replace(`$${key}`, value);
			}
		}
		return (
			<a href={href} data-testid="back-link">
				{children}
			</a>
		);
	},
}));

vi.mock("#/features/event-detail/cache-headers", () => ({
	setPublicEventCacheHeaders: vi.fn(async () => {}),
}));

import { OrganizerPlaceholder } from "./$slug";

afterEach(() => {
	cleanup();
});

describe("OrganizerPlaceholder (Module 2.2 organizer placeholder)", () => {
	it("renders coming-soon copy", () => {
		render(<OrganizerPlaceholder slug="coimbatore-runners" />);

		expect(screen.getByText("Organizer profile coming soon")).toBeTruthy();
		expect(
			screen.getByText(
				"Organizer pages launch with our next release — check back soon.",
			),
		).toBeTruthy();
	});

	it("renders a back-to-home link", () => {
		render(<OrganizerPlaceholder slug="coimbatore-runners" />);

		const back = screen.getByTestId("back-link");
		expect(back.textContent).toBe("Back to home");
		expect(back.getAttribute("href")).toBe("/");
	});
});
