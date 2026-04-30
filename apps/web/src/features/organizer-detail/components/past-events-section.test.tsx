import {
	type EventPublicCard,
	eventPublicCardSchema,
} from "@repo/shared/schemas";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PastEventsSection } from "./past-events-section";

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
		slug: "coimbatore-city-10k-2024",
		title: "Coimbatore City 10K 2024",
		startAt: "2024-08-15T00:30:00.000Z",
		endAt: "2024-08-15T03:30:00.000Z",
		timezone: "Asia/Kolkata",
		city: "Coimbatore",
		venueName: "Race Course Grounds",
		registrationOpensAt: "2024-07-01T03:30:00.000Z",
		registrationClosesAt: "2024-08-14T12:30:00.000Z",
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

describe("PastEventsSection", () => {
	it("renders the 'Past events' heading inside an id='past-events' anchor", () => {
		const { container } = render(
			<PastEventsSection
				events={[]}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
			"Past events",
		);
		const section = container.querySelector("section");
		expect(section?.id).toBe("past-events");
	});

	it("renders one PublicEventCard per event with no empty-state copy", () => {
		const events = [
			fixture(),
			fixture({
				slug: "coimbatore-half-marathon-2024",
				title: "Coimbatore Half Marathon 2024",
			}),
		];

		render(
			<PastEventsSection
				events={events}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		expect(screen.getAllByRole("link")).toHaveLength(2);
		expect(screen.getByText("Coimbatore City 10K 2024")).toBeTruthy();
		expect(screen.getByText("Coimbatore Half Marathon 2024")).toBeTruthy();
		expect(screen.queryByText(/hasn't run any past events yet\./)).toBeNull();
	});

	it("renders the dashed empty state with the organizer's exact name when events is empty", () => {
		const { container } = render(
			<PastEventsSection
				events={[]}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		expect(
			screen.getByText(
				"Race Coimbatore Collective hasn't run any past events yet.",
			),
		).toBeTruthy();
		expect(screen.queryAllByRole("link")).toHaveLength(0);
		const dashed = container.querySelector(".border-dashed");
		expect(dashed).not.toBeNull();
	});

	it("uses a straight ASCII apostrophe in the empty-state copy (regression guard)", () => {
		render(
			<PastEventsSection
				events={[]}
				organizerName="Race Coimbatore Collective"
			/>,
		);

		const copy = screen.getByText(
			/Race Coimbatore Collective hasn.t run any past events yet\./,
		);
		// Straight apostrophe (U+0027), never a curly one (U+2019).
		expect(copy.textContent).toContain("hasn't");
		expect(copy.textContent).not.toContain("hasn\u2019t");
	});

	it("uses the responsive 1/2 column grid (narrower than the homepage)", () => {
		const { container } = render(
			<PastEventsSection
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
