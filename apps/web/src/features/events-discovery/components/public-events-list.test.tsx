import {
	type EventPublicCard,
	eventPublicCardSchema,
} from "@repo/shared/schemas";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicEventsList } from "./public-events-list";

vi.mock("@number-flow/react", () => ({
	default: ({ value }: { value: number }) => (
		<span data-testid="number-flow">₹{value.toLocaleString("en-IN")}</span>
	),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		params,
		...rest
	}: {
		children: ReactNode;
		to: string;
		params?: Record<string, string>;
	} & Record<string, unknown>) => {
		let href = to;
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				href = href.replace(`$${key}`, String(value));
			}
		}
		return (
			<a href={href} {...rest}>
				{children}
			</a>
		);
	},
}));

afterEach(() => {
	cleanup();
});

function fixture(overrides: Record<string, unknown> = {}): EventPublicCard {
	return eventPublicCardSchema.parse({
		slug: "coimbatore-city-10k",
		title: "Coimbatore City 10K",
		startAt: "2026-08-15T00:30:00.000Z",
		endAt: "2026-08-15T03:30:00.000Z",
		timezone: "Asia/Kolkata",
		city: "Coimbatore",
		venueName: "Race Course Grounds",
		registrationOpensAt: "2026-07-01T03:30:00.000Z",
		registrationClosesAt: "2026-08-14T12:30:00.000Z",
		isPaid: true,
		heroImage: null,
		categories: [
			{
				name: "10K",
				slug: "10k",
				distanceMeters: 10000,
				capacity: null,
			},
		],
		pricingTiers: [
			{
				categorySlug: "10k",
				basePrice: 129900,
				earlyBirdPrice: null,
				earlyBirdDeadline: null,
				currency: "INR",
			},
		],
		...overrides,
	});
}

describe("PublicEventsList", () => {
	it("renders one card per event", () => {
		render(
			<PublicEventsList
				events={[
					fixture(),
					fixture({
						slug: "coimbatore-half-marathon",
						title: "Coimbatore Half Marathon",
					}),
				]}
			/>,
		);

		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
			"Upcoming Events in Coimbatore",
		);
		expect(screen.getByText("Coimbatore City 10K")).toBeTruthy();
		expect(screen.getByText("Coimbatore Half Marathon")).toBeTruthy();
		expect(screen.getAllByRole("link")).toHaveLength(2);
	});

	it("renders the Coimbatore empty state when there are no upcoming events", () => {
		render(<PublicEventsList events={[]} />);

		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
			"Upcoming Events in Coimbatore",
		);
		expect(
			screen.getByText(
				"No upcoming events in Coimbatore yet — check back soon!",
			),
		).toBeTruthy();
	});

	it("smoke-renders schema-parsed public card payloads into links", () => {
		const events = [fixture()];

		render(<PublicEventsList events={events} />);

		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.getByRole("link").getAttribute("href")).toBe(
			"/events/coimbatore-city-10k",
		);
	});

	it("uses the responsive three-column grid classes", () => {
		const { container } = render(<PublicEventsList events={[fixture()]} />);

		const grid = container.querySelector(".grid");
		expect(grid?.className).toContain("grid-cols-1");
		expect(grid?.className).toContain("sm:grid-cols-2");
		expect(grid?.className).toContain("lg:grid-cols-3");
	});
});
