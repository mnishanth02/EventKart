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
		params: Record<string, string>;
	}) => {
		let href = to;
		for (const [key, value] of Object.entries(params)) {
			href = href.replace(`$${key}`, value);
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

import { RegisterPlaceholder } from "./register";

afterEach(() => {
	cleanup();
});

describe("RegisterPlaceholder (I-2.1.7 booking-flow placeholder)", () => {
	it("renders coming-soon copy", () => {
		render(<RegisterPlaceholder slug="coimbatore-city-10k" />);

		expect(screen.getByText("Registration coming soon")).toBeTruthy();
		expect(
			screen.getByText("Booking opens with our launch — check back soon."),
		).toBeTruthy();
	});

	it("renders a typed back-link to the event detail page", () => {
		render(<RegisterPlaceholder slug="coimbatore-city-10k" />);

		const back = screen.getByTestId("back-link");
		expect(back.textContent).toBe("Back to event details");
		expect(back.getAttribute("href")).toBe("/events/coimbatore-city-10k");
	});

	it("interpolates the slug into the back-link for any event", () => {
		render(<RegisterPlaceholder slug="some-other-event" />);

		expect(screen.getByTestId("back-link").getAttribute("href")).toBe(
			"/events/some-other-event",
		);
	});
});
