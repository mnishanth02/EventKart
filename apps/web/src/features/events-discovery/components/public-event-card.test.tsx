import {
	EVENT_DISCOVERY_STATUS_LABELS,
	type EventDiscoveryStatus,
} from "@repo/shared/utils";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStartingPrice } from "#/features/event-detail/pricing";
import type { EventCardData } from "../types";
import { PublicEventCard } from "./public-event-card";

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
	vi.useRealTimers();
	cleanup();
});

const fixedNow = new Date("2026-07-15T00:00:00.000Z");

function categorySlug(
	value: string,
): EventCardData["categories"][number]["slug"] {
	return value as EventCardData["categories"][number]["slug"];
}

function eventSlug(value: string): EventCardData["slug"] {
	return value as EventCardData["slug"];
}

function fixture(overrides: Partial<EventCardData> = {}): EventCardData {
	return {
		slug: eventSlug("coimbatore-city-10k"),
		title: "Coimbatore City 10K",
		startAt: "2026-08-15T00:30:00.000Z",
		endAt: "2026-08-15T03:30:00.000Z",
		timezone: "Asia/Kolkata",
		city: "Coimbatore",
		venueName: "Race Course Grounds",
		registrationOpensAt: "2026-07-01T03:30:00.000Z",
		registrationClosesAt: "2026-08-14T12:30:00.000Z",
		isPaid: true,
		heroImage: {
			kind: "hero",
			contentType: "image/jpeg",
			url: "https://cdn.example.com/events/coimbatore-hero.jpg",
			expiresAt: "2026-08-14T12:00:00.000Z",
		},
		categories: [
			{
				name: "10K Open",
				slug: categorySlug("10k"),
				distanceMeters: 10000,
				capacity: { spotsTotal: 200, spotsRemaining: 150 },
			},
			{
				name: "5K Fun Run",
				slug: categorySlug("5k"),
				distanceMeters: 5000,
				capacity: { spotsTotal: 100, spotsRemaining: 8 },
			},
		],
		pricingTiers: [
			{
				categorySlug: categorySlug("10k"),
				basePrice: 129_900,
				earlyBirdPrice: null,
				earlyBirdDeadline: null,
				currency: "INR",
			},
			{
				categorySlug: categorySlug("5k"),
				basePrice: 79_900,
				earlyBirdPrice: 59_900,
				earlyBirdDeadline: "2026-07-30T12:30:00.000Z",
				currency: "INR",
			},
		],
		...overrides,
	};
}

function renderAtTime(event: EventCardData, now = fixedNow) {
	vi.useFakeTimers({
		toFake: ["Date", "setTimeout", "queueMicrotask", "setImmediate"],
	});
	vi.setSystemTime(now);
	return render(<PublicEventCard event={event} />);
}

function flushMount() {
	act(() => {
		vi.advanceTimersByTime(0);
	});
}

describe("PublicEventCard", () => {
	it("renders title, date range, location, and categories", () => {
		renderAtTime(fixture());
		flushMount();

		expect(
			screen.getByRole("heading", { level: 3, name: "Coimbatore City 10K" }),
		).toBeTruthy();
		expect(screen.getByText("15 Aug 2026 · 6:00 – 9:00 am")).toBeTruthy();
		expect(screen.getByText("Race Course Grounds, Coimbatore")).toBeTruthy();
		expect(screen.getByText("10K Open and 5K Fun Run")).toBeTruthy();
	});

	it("omits the volatile status and From price from SSR HTML", () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(fixedNow);

		const html = renderToString(<PublicEventCard event={fixture()} />);

		expect(html).not.toContain("Registration open");
		expect(html).not.toContain('data-testid="card-status-badge"');
		expect(html).not.toContain('data-testid="price-from"');
	});

	it.each([
		[
			"upcoming",
			fixture({
				registrationOpensAt: "2026-08-01T00:00:00.000Z",
				registrationClosesAt: "2026-08-14T12:30:00.000Z",
			}),
		],
		[
			"registration_open",
			fixture({
				registrationOpensAt: "2026-07-01T00:00:00.000Z",
				registrationClosesAt: "2026-08-14T12:30:00.000Z",
			}),
		],
		[
			"registration_closed",
			fixture({
				registrationOpensAt: "2026-07-01T00:00:00.000Z",
				registrationClosesAt: "2026-07-14T12:30:00.000Z",
			}),
		],
		[
			"sold_out",
			fixture({
				categories: [
					{
						name: "10K Open",
						slug: categorySlug("10k"),
						distanceMeters: 10000,
						capacity: { spotsTotal: 200, spotsRemaining: 0 },
					},
				],
			}),
		],
		[
			"event_ended",
			fixture({
				endAt: "2026-07-14T03:30:00.000Z",
			}),
		],
	] satisfies Array<
		[EventDiscoveryStatus, EventCardData]
	>)("renders the %s badge after mount", (status, event) => {
		renderAtTime(event);
		flushMount();

		const badge = screen.getByTestId("card-status-badge");
		expect(badge.textContent).toContain(EVENT_DISCOVERY_STATUS_LABELS[status]);
		expect(badge.querySelector("svg")).toBeTruthy();
	});

	it("renders From price after mount using the starting price", () => {
		const event = fixture();
		renderAtTime(event);
		flushMount();

		const starting = getStartingPrice(event.pricingTiers, fixedNow);
		expect(starting).not.toBeNull();
		expect(screen.getByTestId("price-from").textContent).toContain(
			`₹${((starting?.pricePaise ?? 0) / 100).toLocaleString("en-IN")}`,
		);
	});

	it("renders Free for unpaid events in SSR and after mount", () => {
		const event = fixture({ isPaid: false });
		expect(renderToString(<PublicEventCard event={event} />)).toContain("Free");

		renderAtTime(event);
		flushMount();

		expect(screen.getByText("Free")).toBeTruthy();
	});

	it("renders Pricing TBA for paid events without tiers in SSR and after mount", () => {
		const event = fixture({ pricingTiers: [] });
		expect(renderToString(<PublicEventCard event={event} />)).toContain(
			"Pricing TBA",
		);

		renderAtTime(event);
		flushMount();

		expect(screen.getByText("Pricing TBA")).toBeTruthy();
	});

	it("renders hero image with lazy-loading attributes", () => {
		renderAtTime(fixture());
		flushMount();

		const image = screen.getByRole("img", {
			name: "Coimbatore City 10K",
		}) as HTMLImageElement;
		expect(image.getAttribute("src")).toBe(
			"https://cdn.example.com/events/coimbatore-hero.jpg",
		);
		expect(image.getAttribute("loading")).toBe("lazy");
		expect(image.getAttribute("decoding")).toBe("async");
	});

	it("renders the gradient placeholder when hero image is absent", () => {
		renderAtTime(fixture({ heroImage: null }));
		flushMount();

		expect(screen.getByTestId("card-hero-placeholder")).toBeTruthy();
	});

	it("renders a single navigation link to the public event route", () => {
		renderAtTime(fixture());
		flushMount();

		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0]?.getAttribute("href")).toBe("/events/coimbatore-city-10k");
	});

	it("uses one h3 title and no duplicate aria-label on the link", () => {
		renderAtTime(fixture());
		flushMount();

		expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
		expect(screen.getByRole("link").hasAttribute("aria-label")).toBe(false);
	});

	it("keeps registration-closed precedence over sold-out capacity", () => {
		renderAtTime(
			fixture({
				registrationClosesAt: "2026-07-14T12:30:00.000Z",
				categories: [
					{
						name: "10K Open",
						slug: categorySlug("10k"),
						distanceMeters: 10000,
						capacity: { spotsTotal: 200, spotsRemaining: 0 },
					},
				],
			}),
		);
		flushMount();

		expect(screen.getByText("Registration closed")).toBeTruthy();
		expect(screen.queryByText("Sold out")).toBeNull();
	});

	it("de-emphasizes price for sold-out events after mount", () => {
		renderAtTime(
			fixture({
				categories: [
					{
						name: "10K Open",
						slug: categorySlug("10k"),
						distanceMeters: 10000,
						capacity: { spotsTotal: 200, spotsRemaining: 0 },
					},
				],
			}),
		);
		flushMount();

		const price = screen.getByTestId("price-from").closest(".line-through");
		expect(price).toBeTruthy();
	});

	it("renders category overflow as the first three plus the count", () => {
		renderAtTime(
			fixture({
				categories: [
					{
						name: "5K",
						slug: categorySlug("5k"),
						distanceMeters: 5000,
						capacity: null,
					},
					{
						name: "10K",
						slug: categorySlug("10k"),
						distanceMeters: 10000,
						capacity: null,
					},
					{
						name: "21K",
						slug: categorySlug("21k"),
						distanceMeters: 21097,
						capacity: null,
					},
					{
						name: "42K",
						slug: categorySlug("42k"),
						distanceMeters: 42195,
						capacity: null,
					},
					{
						name: "Kids",
						slug: categorySlug("kids"),
						distanceMeters: 1000,
						capacity: null,
					},
				],
			}),
		);
		flushMount();

		expect(screen.getByText("5K, 10K and 21K +2 more")).toBeTruthy();
	});
});
