import {
	act,
	cleanup,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eventPublicDetailSchema } from "@repo/shared/schemas";
import type { EventPublicDetail } from "../types";
import { PublicEventOrganizerCard } from "./public-event-organizer-card";
import { PublicEventPage } from "./public-event-page";

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
		// Drop `params` to keep the rendered DOM clean of unknown attrs.
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

const refundPolicy = "Refunds are available until 14 days before race day.";
const cancellationPolicy =
	"If the race is cancelled, all registered runners receive a transfer option.";
const heroImageUrl = "https://cdn.example.com/events/coimbatore-hero.jpg";
const routeMapImageUrl = "https://cdn.example.com/events/coimbatore-route.png";
const organizerDescription =
	"Race Coimbatore Collective produces the city's flagship endurance events.";

const fixtureInput = {
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
		description: organizerDescription,
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
};

function buildFixture(
	organizerOverrides: Partial<EventPublicDetail["organizer"]> = {},
): EventPublicDetail {
	return eventPublicDetailSchema.parse({
		...fixtureInput,
		organizer: {
			...fixtureInput.organizer,
			...organizerOverrides,
		},
	});
}

const fixture = buildFixture();

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
		const { rerender, container } = render(
			<PublicEventPage event={fixture} />,
		);

		expect(screen.getByText(refundPolicy)).toBeTruthy();
		expect(screen.getByText(cancellationPolicy)).toBeTruthy();
		expect(screen.getByLabelText("Verified organizer")).toBeTruthy();
		expect(container.querySelector("section#policies")).not.toBeNull();
		expect(container.querySelector("section#refund-policy")).not.toBeNull();
		expect(container.querySelector("section#cancellation-policy")).not.toBeNull();
		expect(
			screen.getByText(
				/Review Race Coimbatore Collective's refund and cancellation terms before booking\./,
			),
		).toBeTruthy();

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
		expect(screen.queryByLabelText("Verified organizer")).toBeNull();
		expect(
			screen.getByText(
				"Race Coimbatore Collective has not published refund or cancellation policies for this event.",
			),
		).toBeTruthy();
	});

	it("renders organizer summary and sidebar policy anchor", () => {
		// Use a frozen time inside the registration window so the post-mount
		// CTA state is deterministic ("open"). The dedicated I-2.1.7 suite
		// below covers the live state-aware CTA copy (and the SSR-neutral
		// baseline via `renderToString`); this test only owns the organizer
		// summary + policy anchor.
		vi.useFakeTimers({
			toFake: ["Date", "setTimeout", "queueMicrotask", "setImmediate"],
		});
		vi.setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
		render(<PublicEventPage event={fixture} />);

		expect(screen.getByText("About the organizer")).toBeTruthy();
		expect(screen.getByText("Race Coimbatore Collective")).toBeTruthy();
		expect(screen.getByText("Based in Coimbatore")).toBeTruthy();
		expect(
			screen
				.getByRole("link", {
					name: "View profile of Race Coimbatore Collective",
				})
				.getAttribute("href"),
		).toBe("/organizers/race-coimbatore");

		const policyLink = screen.getByRole("link", {
			name: /Review refund.*cancellation policies/i,
		});
		expect(policyLink.getAttribute("href")).toBe("#policies");

		vi.useRealTimers();
	});
});

describe("PublicEventOrganizerCard", () => {
	it("links to the organizer profile", () => {
		render(<PublicEventOrganizerCard organizer={buildFixture().organizer} />);

		const profileLink = screen.getByRole("link", {
			name: /View profile of Race Coimbatore Collective/i,
		});
		expect(profileLink.getAttribute("href")).toBe(
			"/organizers/race-coimbatore",
		);
	});

	it("renders the organizer description when non-null", () => {
		render(<PublicEventOrganizerCard organizer={buildFixture().organizer} />);

		expect(screen.getByText(organizerDescription)).toBeTruthy();
	});

	it("hides the organizer description when null", () => {
		const { rerender } = render(
			<PublicEventOrganizerCard organizer={buildFixture().organizer} />,
		);

		expect(screen.getByText(organizerDescription)).toBeTruthy();

		rerender(
			<PublicEventOrganizerCard
				organizer={buildFixture({ description: null }).organizer}
			/>,
		);

		expect(screen.queryByText(organizerDescription)).toBeNull();
	});

	it("renders organizer descriptions as escaped text", () => {
		const xssDescription =
			"Trusted <script>alert(1)</script> & <b>fast</b> races";
		const { container } = render(
			<PublicEventOrganizerCard
				organizer={buildFixture({ description: xssDescription }).organizer}
			/>,
		);

		expect(screen.getByText(xssDescription)).toBeTruthy();
		expect(container.querySelectorAll("script")).toHaveLength(0);
		expect(container.querySelectorAll("b")).toHaveLength(0);
	});

	it("renders a maximum-length organizer description", () => {
		const longDescription = "a".repeat(2000);
		render(
			<PublicEventOrganizerCard
				organizer={buildFixture({ description: longDescription }).organizer}
			/>,
		);

		const paragraph = screen.getByText(longDescription);
		expect(paragraph.textContent).toHaveLength(2000);
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
		// `render(...)` auto-wraps in `act`, which flushes the initial
		// `useEffect` so `useNow` and `useRegistrationState` commit their
		// post-mount state. We deliberately do NOT advance fake timers —
		// `useRegistrationState` schedules a chained `setTimeout` at the
		// next boundary, and `vi.runAllTimers()` would chase that chain
		// across all future boundaries (days/weeks ahead).
		return render(<PublicEventPage event={event} />);
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

describe("PublicEventPage registration CTA (I-2.1.7)", () => {
	const insideWindow = new Date("2026-07-15T00:00:00.000Z");
	const beforeOpen = new Date("2026-06-01T00:00:00.000Z");
	const afterClose = new Date("2026-08-14T18:00:00.000Z");
	const afterEnd = new Date("2026-08-16T00:00:00.000Z");

	function renderAtTime(now: Date, event: EventPublicDetail = fixture) {
		vi.useFakeTimers({
			toFake: ["Date", "setTimeout", "queueMicrotask", "setImmediate"],
		});
		vi.setSystemTime(now);
		// See the I-2.1.4 helper above for why we don't advance fake timers
		// here — the chained boundary `setTimeout` in `useRegistrationState`
		// must not fire, otherwise `vi.runAllTimers()` chases the chain
		// past every future boundary.
		return render(<PublicEventPage event={event} />);
	}

	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it("renders SSR-neutral copy and a 'View registration' link to the booking flow (renderToString)", async () => {
		vi.useFakeTimers({
			toFake: ["Date", "setTimeout", "queueMicrotask", "setImmediate"],
		});
		vi.setSystemTime(insideWindow);
		const { renderToString } = await import("react-dom/server");
		const html = renderToString(<PublicEventPage event={fixture} />);

		expect(html).toContain("View registration");
		expect(html).toContain('href="/events/coimbatore-city-10k/register"');

		// Pre-mount must NEVER advertise the live state (cache truthfulness).
		expect(html).not.toContain("Register now");
		expect(html).not.toContain("Registration closed");
		expect(html).not.toContain("Registration opens ");
		expect(html).not.toContain("Event has ended");
		expect(html).not.toContain('data-testid="price-from"');
	});

	it("renders an active 'Register now' link to the booking flow when registration is open", () => {
		renderAtTime(insideWindow);

		const registerLinks = screen.getAllByRole("link", {
			name: /^Register now$/,
		});
		expect(registerLinks.length).toBe(2);
		for (const link of registerLinks) {
			expect(link.getAttribute("href")).toBe(
				"/events/coimbatore-city-10k/register",
			);
		}
		// Price hint shown alongside an open CTA.
		expect(screen.getAllByTestId("price-from").length).toBe(2);
	});

	it("renders a disabled 'Registration opens ...' button before the window opens with aria-describedby + price still shown", () => {
		renderAtTime(beforeOpen);

		const buttons = screen.getAllByRole("button", {
			name: /Registration opens /,
		});
		expect(buttons.length).toBe(2);
		for (const button of buttons) {
			expect(button.getAttribute("disabled")).not.toBeNull();
			expect(button.getAttribute("aria-disabled")).toBe("true");
			expect(button.getAttribute("aria-describedby")).toMatch(
				/^register-cta-(reason|mobile-reason)$/,
			);
		}
		// Active-state link must NOT be present.
		expect(screen.queryAllByRole("link", { name: /^Register now$/ }).length).toBe(
			0,
		);
		// Price hint stays visible — registration hasn't closed yet.
		expect(screen.getAllByTestId("price-from").length).toBe(2);
	});

	it("renders a disabled 'Registration closed' button after closesAt and hides the price hint", () => {
		renderAtTime(afterClose);

		const buttons = screen.getAllByRole("button", {
			name: /^Registration closed$/,
		});
		expect(buttons.length).toBe(2);
		for (const button of buttons) {
			expect(button.getAttribute("disabled")).not.toBeNull();
			expect(button.getAttribute("aria-disabled")).toBe("true");
		}
		expect(screen.queryAllByRole("link", { name: /^Register now$/ }).length).toBe(
			0,
		);
		// Price hint is hidden so the UI never reads "From ₹X — Registration closed".
		expect(screen.queryAllByTestId("price-from").length).toBe(0);
	});

	it("renders a disabled 'Event has ended' button after endAt and hides the price hint", () => {
		renderAtTime(afterEnd);

		const buttons = screen.getAllByRole("button", {
			name: /^Event has ended$/,
		});
		expect(buttons.length).toBe(2);
		for (const button of buttons) {
			expect(button.getAttribute("disabled")).not.toBeNull();
			expect(button.getAttribute("aria-disabled")).toBe("true");
		}
		expect(screen.queryAllByTestId("price-from").length).toBe(0);
	});

	it("treats both registration timestamps as null + future endAt → 'Register now' active CTA", () => {
		const noWindow: EventPublicDetail = {
			...fixture,
			registrationOpensAt: null,
			registrationClosesAt: null,
		};
		renderAtTime(insideWindow, noWindow);

		const links = screen.getAllByRole("link", { name: /^Register now$/ });
		expect(links.length).toBe(2);
	});

	it("transitions the CTA from 'Register now' → 'Registration closed' when the window closes mid-page", () => {
		const tenMsBeforeClose = new Date(
			Date.parse(fixture.registrationClosesAt ?? "") - 10,
		);
		vi.useFakeTimers({
			toFake: ["Date", "setTimeout", "queueMicrotask", "setImmediate"],
		});
		vi.setSystemTime(tenMsBeforeClose);
		render(<PublicEventPage event={fixture} />);

		// Before the boundary: active links rendered. RTL auto-act flushes
		// the initial useEffect so `useRegistrationState` has already
		// committed the post-mount "open" state.
		expect(
			screen.queryAllByRole("link", { name: /^Register now$/ }).length,
		).toBe(2);

		// Advance just past the close boundary; the chained setTimeout in
		// useRegistrationState should fire and re-render disabled buttons.
		act(() => {
			vi.advanceTimersByTime(50);
		});

		expect(
			screen.queryAllByRole("link", { name: /^Register now$/ }).length,
		).toBe(0);
		expect(
			screen.queryAllByRole("button", { name: /^Registration closed$/ })
				.length,
		).toBe(2);
	});
});
