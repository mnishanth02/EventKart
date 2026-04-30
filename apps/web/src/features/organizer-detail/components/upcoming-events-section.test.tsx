import {
	type EventPublicCard,
	eventPublicCardSchema,
} from "@repo/shared/schemas";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpcomingEventsSection } from "./upcoming-events-section";

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

describe("UpcomingEventsSection", () => {
	it("renders the 'Upcoming events' heading", () => {
		render(
			<UpcomingEventsSection
				events={[]}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
			"Upcoming events",
		);
	});

	it("anchors the section with id='upcoming-events' for deep links", () => {
		const { container } = render(
			<UpcomingEventsSection
				events={[]}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		const section = container.querySelector("section");
		expect(section?.id).toBe("upcoming-events");
	});

	it("renders the empty state with the organizer name and no cards when events is empty", () => {
		render(
			<UpcomingEventsSection
				events={[]}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		expect(
			screen.getByText(
				"Race Coimbatore Collective has no upcoming events listed yet.",
			),
		).toBeTruthy();
		expect(screen.queryAllByRole("link")).toHaveLength(0);
	});

	it("renders one PublicEventCard per event with no empty-state copy", () => {
		const events = [
			fixture(),
			fixture({
				slug: "coimbatore-half-marathon",
				title: "Coimbatore Half Marathon",
			}),
		];

		render(
			<UpcomingEventsSection
				events={events}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		expect(screen.getAllByRole("link")).toHaveLength(2);
		expect(screen.getByText("Coimbatore City 10K")).toBeTruthy();
		expect(screen.getByText("Coimbatore Half Marathon")).toBeTruthy();
		expect(
			screen.queryByText(/has no upcoming events listed yet\./),
		).toBeNull();

		const links = screen.getAllByRole("link");
		expect(links[0]?.getAttribute("href")).toBe("/events/coimbatore-city-10k");
		expect(links[1]?.getAttribute("href")).toBe(
			"/events/coimbatore-half-marathon",
		);
	});

	it("uses the responsive 1/2 column grid (narrower than the homepage)", () => {
		const { container } = render(
			<UpcomingEventsSection
				events={[fixture()]}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		const grid = container.querySelector(".grid");
		expect(grid?.className).toContain("grid-cols-1");
		expect(grid?.className).toContain("md:grid-cols-2");
		expect(grid?.className).not.toContain("lg:grid-cols-3");
	});
});
