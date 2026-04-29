import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eventPublicDetailSchema } from "@repo/shared/schemas";
import type { EventPublicDetail } from "../types";
import { PublicEventPage } from "./public-event-page";

vi.mock("@number-flow/react", () => ({
	default: ({ value }: { value: number }) => (
		<span data-testid="number-flow">₹{value.toLocaleString("en-IN")}</span>
	),
}));

afterEach(() => {
	cleanup();
});

const refundPolicy = "Refunds are available until 14 days before race day.";
const cancellationPolicy =
	"If the race is cancelled, all registered runners receive a transfer option.";
const heroImageUrl = "https://cdn.example.com/events/coimbatore-hero.jpg";
const routeMapImageUrl = "https://cdn.example.com/events/coimbatore-route.png";

const fixture: EventPublicDetail = eventPublicDetailSchema.parse({
	slug: "coimbatore-city-10k",
	title: "Coimbatore City 10K",
	description:
		"A polished city race with shaded roads, hydration support, and a festive finish line.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road",
	addressLine2: "Near Arts College",
	city: "Coimbatore",
	state: "Tamil Nadu",
	country: "India",
	postalCode: "641018",
	timezone: "Asia/Kolkata",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails:
		"Start at Race Course, loop through Avinashi Road, and finish under the grandstand.",
	refundPolicy,
	cancellationPolicy,
	isPaid: true,
	currency: "INR",
	organizer: {
		slug: "race-coimbatore",
		businessName: "Race Coimbatore Collective",
		isVerified: true,
		city: "Coimbatore",
	},
	heroImage: {
		kind: "hero",
		contentType: "image/jpeg",
		url: heroImageUrl,
		expiresAt: "2026-08-14T12:00:00.000Z",
	},
	routeMapImage: {
		kind: "route_map",
		contentType: "image/png",
		url: routeMapImageUrl,
		expiresAt: "2026-08-14T12:00:00.000Z",
	},
	categories: [
		{
			name: "10K Open",
			slug: "10k",
			distanceMeters: 10000,
			sortOrder: 2,
		},
		{
			name: "5K Fun Run",
			slug: "5k",
			distanceMeters: 5000,
			sortOrder: 1,
		},
	],
	pricingTiers: [
		{
			categorySlug: "10k",
			basePrice: 129_900,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
			currency: "INR",
		},
		{
			categorySlug: "5k",
			basePrice: 79_900,
			earlyBirdPrice: 59_900,
			earlyBirdDeadline: "2026-07-15T12:30:00.000Z",
			currency: "INR",
		},
	],
});

describe("PublicEventPage", () => {
	it("renders the title and hero imagery with accessible alternatives", () => {
		const { rerender } = render(<PublicEventPage event={fixture} />);

		expect(
			screen.getByRole("heading", {
				level: 1,
				name: "Coimbatore City 10K",
			}),
		).toBeTruthy();
		const heroImage = screen.getByRole("img", {
			name: "Coimbatore City 10K event hero image",
		}) as HTMLImageElement;
		expect(heroImage.getAttribute("src")).toBe(heroImageUrl);

		rerender(<PublicEventPage event={{ ...fixture, heroImage: null }} />);

		expect(screen.getByTestId("hero-image-placeholder")).toBeTruthy();
	});

	it("renders the route map image with the prescribed alt text", () => {
		render(<PublicEventPage event={fixture} />);

		const routeMapImage = screen.getByRole("img", {
			name: "Route map for Coimbatore City 10K",
		}) as HTMLImageElement;
		expect(routeMapImage.getAttribute("src")).toBe(routeMapImageUrl);
	});

	it("renders categories in sort order", () => {
		render(<PublicEventPage event={fixture} />);
		const categoriesTable = screen.getByRole("table", {
			name: /available event categories/i,
		});
		const rows = within(categoriesTable).getAllByRole("row").slice(1);

		expect(rows[0]?.textContent).toContain("5K Fun Run");
		expect(rows[0]?.textContent).toContain("5 km");
		expect(rows[1]?.textContent).toContain("10K Open");
		expect(rows[1]?.textContent).toContain("10 km");
	});

	it("renders INR pricing and early-bird details only for eligible tiers", () => {
		render(<PublicEventPage event={fixture} />);
		const pricingTable = screen.getByRole("table", {
			name: /registration pricing by category/i,
		});

		expect(within(pricingTable).getByText("₹799")).toBeTruthy();
		expect(within(pricingTable).getByText("₹599")).toBeTruthy();
		expect(within(pricingTable).getByText("₹1,299")).toBeTruthy();
		expect(within(pricingTable).getByText(/Until/)).toBeTruthy();

		const rows = within(pricingTable).getAllByRole("row");
		const tenKRow = rows.find((row) => row.textContent?.includes("10K Open"));
		expect(tenKRow).toBeDefined();
		expect(tenKRow?.textContent).not.toContain("Until");
	});

	it("guards policy and verified-organizer text", () => {
		const { rerender } = render(<PublicEventPage event={fixture} />);

		expect(screen.getByText(refundPolicy)).toBeTruthy();
		expect(screen.getByText(cancellationPolicy)).toBeTruthy();
		expect(screen.getByText("Verified organizer")).toBeTruthy();

		rerender(
			<PublicEventPage
				event={{
					...fixture,
					refundPolicy: null,
					cancellationPolicy: null,
					organizer: { ...fixture.organizer, isVerified: false },
				}}
			/>,
		);

		expect(screen.queryByText(refundPolicy)).toBeNull();
		expect(screen.queryByText(cancellationPolicy)).toBeNull();
		expect(screen.queryByText("Verified organizer")).toBeNull();
	});

	it("renders CTA copy and organizer summary", () => {
		render(<PublicEventPage event={fixture} />);

		expect(
			screen.getAllByText("Registration coming soon").length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText("Booking opens with our launch — check back soon.")
				.length,
		).toBeGreaterThan(0);
		expect(screen.getByText("Race Coimbatore Collective")).toBeTruthy();
		expect(screen.getByText(/Organized by/).textContent).toContain(
			"Coimbatore",
		);
	});
});
