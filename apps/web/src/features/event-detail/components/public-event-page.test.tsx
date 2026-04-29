import {
	act,
	cleanup,
	render,
	screen,
	within,
} from "@testing-library/react";
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
		description: null,
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

	it("renders categories in sort order in the combined breakdown table", () => {
		render(<PublicEventPage event={fixture} />);
		const breakdownTable = screen.getByRole("table", {
			name: /race categories with distance and registration pricing/i,
		});
		const rows = within(breakdownTable).getAllByRole("row").slice(1);

		expect(rows[0]?.textContent).toContain("5K Fun Run");
		expect(rows[0]?.textContent).toContain("5 km");
		expect(rows[1]?.textContent).toContain("10K Open");
		expect(rows[1]?.textContent).toContain("10 km");
	});

	it("renders INR pricing and early-bird details only for eligible tiers in the combined breakdown", () => {
		render(<PublicEventPage event={fixture} />);
		const breakdownTable = screen.getByRole("table", {
			name: /race categories with distance and registration pricing/i,
		});

		expect(within(breakdownTable).getByText("₹799")).toBeTruthy();
		expect(within(breakdownTable).getByText("₹599")).toBeTruthy();
		expect(within(breakdownTable).getByText("₹1,299")).toBeTruthy();
		expect(within(breakdownTable).getByText(/Until/)).toBeTruthy();

		const rows = within(breakdownTable).getAllByRole("row");
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

describe("PublicEventPage volatile pricing state (I-2.1.4)", () => {
	const beforeDeadline = new Date("2026-07-10T00:00:00.000Z");
	const afterDeadline = new Date("2026-07-20T00:00:00.000Z");

	function renderAtTime(now: Date, event: EventPublicDetail = fixture) {
		vi.useFakeTimers({
			toFake: ["Date", "setTimeout", "queueMicrotask", "setImmediate"],
		});
		vi.setSystemTime(now);
		const utils = render(<PublicEventPage event={event} />);
		act(() => {
			vi.runAllTimers();
		});
		return utils;
	}

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it("shows the 'Active' badge while the early-bird window is open", () => {
		renderAtTime(beforeDeadline);
		const breakdownTable = screen.getByRole("table", {
			name: /race categories with distance and registration pricing/i,
		});
		expect(within(breakdownTable).getAllByText("Active").length).toBeGreaterThan(
			0,
		);
		expect(within(breakdownTable).queryByText("Expired")).toBeNull();
	});

	it("shows the 'Expired' badge after the deadline has passed", () => {
		renderAtTime(afterDeadline);
		const breakdownTable = screen.getByRole("table", {
			name: /race categories with distance and registration pricing/i,
		});
		expect(within(breakdownTable).getAllByText("Expired").length).toBeGreaterThan(
			0,
		);
		expect(within(breakdownTable).queryByText("Active")).toBeNull();
	});

	it("renders 'From ₹599 (early-bird)' in both CTA surfaces while the discount is active", () => {
		renderAtTime(beforeDeadline);
		const fromBadges = screen.getAllByTestId("price-from");
		// One in the sticky aside CTA, one in the fixed mobile bottom bar.
		expect(fromBadges.length).toBe(2);
		for (const badge of fromBadges) {
			expect(badge.textContent).toContain("From");
			expect(badge.textContent).toContain("₹599");
			expect(badge.textContent).toContain("(early-bird)");
		}
	});

	it("renders 'From ₹799' (no early-bird tag) once the discount has expired", () => {
		renderAtTime(afterDeadline);
		const fromBadges = screen.getAllByTestId("price-from");
		expect(fromBadges.length).toBe(2);
		for (const badge of fromBadges) {
			expect(badge.textContent).toContain("From");
			expect(badge.textContent).toContain("₹799");
			expect(badge.textContent).not.toContain("(early-bird)");
		}
	});

	it("omits the 'From' badge entirely when there are no pricing tiers", () => {
		renderAtTime(beforeDeadline, {
			...fixture,
			pricingTiers: [],
		});
		expect(screen.queryAllByTestId("price-from").length).toBe(0);
	});

	it("renders no Active/Expired badge or 'From' price during SSR (renderToString)", async () => {
		// True SSR test: render the page on the server (no useEffect runs),
		// then assert the HTML never advertises a volatile signal that could
		// be wrong by the time a CDN-cached response reaches a client.
		vi.useFakeTimers({
			toFake: ["Date", "setTimeout", "queueMicrotask", "setImmediate"],
		});
		vi.setSystemTime(beforeDeadline);
		const { renderToString } = await import("react-dom/server");
		const html = renderToString(<PublicEventPage event={fixture} />);
		expect(html).not.toContain(">Active<");
		expect(html).not.toContain(">Expired<");
		expect(html).not.toContain('data-testid="price-from"');
	});

	it("treats earlyBirdPrice >= basePrice as no offer in both UI and CTA (legacy guard)", () => {
		// Regression: previously the breakdown UI and the From INRX CTA could
		// disagree because the helper applied the guard but the column did not.
		// Now both surfaces route through hasValidEarlyBirdOffer.
		const tenKTier = fixture.pricingTiers[0];
		const fiveKTier = fixture.pricingTiers[1];
		if (!tenKTier || !fiveKTier) {
			throw new Error("test fixture must define both 10K and 5K tiers");
		}
		const legacyEvent: EventPublicDetail = {
			...fixture,
			pricingTiers: [
				{ ...tenKTier },
				{
					categorySlug: fiveKTier.categorySlug,
					basePrice: 79_900,
					// Same as basePrice — the legacy guard must hide the offer.
					earlyBirdPrice: 79_900,
					earlyBirdDeadline: "2099-12-31T00:00:00.000Z",
					currency: "INR",
				},
			],
		};
		renderAtTime(beforeDeadline, legacyEvent);

		const breakdownTable = screen.getByRole("table", {
			name: /race categories with distance and registration pricing/i,
		});
		// No tier has a valid early-bird offer, so the column is omitted.
		expect(
			within(breakdownTable).queryByRole("columnheader", { name: "Early bird" }),
		).toBeNull();
		expect(within(breakdownTable).queryByText("Active")).toBeNull();
		expect(within(breakdownTable).queryByText("Expired")).toBeNull();

		const fromBadges = screen.getAllByTestId("price-from");
		expect(fromBadges.length).toBe(2);
		for (const badge of fromBadges) {
			expect(badge.textContent).toContain("From");
			// Falls back to the cheapest base price (₹799) — never the bogus EB price.
			expect(badge.textContent).toContain("₹799");
			expect(badge.textContent).not.toContain("(early-bird)");
		}
	});
});
