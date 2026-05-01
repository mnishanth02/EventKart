import {
	type EventPublicCard,
	eventPublicCardSchema,
	organizerPublicProfileSchema,
} from "@repo/shared/schemas";
import type { QueryClient } from "@tanstack/react-query";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePublicOrganizerLoader } from "#/features/organizer-detail/loader";
import type { PastEventsApiEnvelope } from "#/features/organizer-detail/past-events-api.server";
import type {
	OrganizerPublicLookupResponse,
	OrganizerPublicProfile,
} from "#/features/organizer-detail/types";
import type { UpcomingEventsApiEnvelope } from "#/features/organizer-detail/upcoming-events-api.server";

vi.hoisted(() => {
	process.env.VITE_API_URL ??= "https://api.eventkart.app";
});

vi.mock("@number-flow/react", () => ({
	default: ({ value }: { value: number }) => (
		<span data-testid="number-flow">₹{value.toLocaleString("en-IN")}</span>
	),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router",
	);
	return {
		...actual,
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
	};
});

import { OrganizerDetailView } from "#/routes/_public/organizers/$slug";

const profileInput = {
	slug: "race-coimbatore",
	businessName: "Race Coimbatore Collective",
	isVerified: true,
	city: "Coimbatore",
	description: "Endurance events from Coimbatore.",
} as const;

const profile: OrganizerPublicProfile =
	organizerPublicProfileSchema.parse(profileInput);

const emptyUpcomingEnvelope: UpcomingEventsApiEnvelope = {
	success: true,
	data: [],
	meta: {
		page: 1,
		limit: 12,
		total: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false,
	},
};

const emptyPastEnvelope: PastEventsApiEnvelope = {
	success: true,
	data: [],
	meta: {
		page: 1,
		limit: 12,
		total: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false,
	},
};

interface QueryFn {
	queryKey: ReadonlyArray<unknown>;
}

function queryClientReturning(
	payload: OrganizerPublicLookupResponse,
): QueryClient {
	return {
		ensureQueryData: vi.fn(async (options: QueryFn) => {
			const head = options.queryKey[0];
			if (head === "organizer-detail") return payload;
			if (head === "organizer-upcoming-events") return emptyUpcomingEnvelope;
			if (head === "organizer-past-events") return emptyPastEnvelope;
			throw new Error(`Unexpected query key: ${String(head)}`);
		}),
	} as unknown as QueryClient;
}

function queryClientRejecting(error: unknown): QueryClient {
	return {
		ensureQueryData: vi.fn(async (options: QueryFn) => {
			const head = options.queryKey[0];
			if (head === "organizer-detail") throw error;
			if (head === "organizer-upcoming-events") return emptyUpcomingEnvelope;
			if (head === "organizer-past-events") return emptyPastEnvelope;
			throw new Error(`Unexpected query key: ${String(head)}`);
		}),
	} as unknown as QueryClient;
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	cleanup();
});

function eventFixture(
	overrides: Record<string, unknown> = {},
): EventPublicCard {
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
			{ name: "10K", slug: "10k", distanceMeters: 10000, capacity: null },
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

describe("/_public/organizers/$slug — resolvePublicOrganizerLoader", () => {
	it("returns the organizer profile and writes the public CDN cache headers", async () => {
		const setResponseHeaders = vi.fn();

		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: queryClientReturning({ kind: "organizer", data: profile }),
			setResponseHeaders,
		});

		expect(result.profile).toBe(profile);
		expect(result.upcomingEvents).toEqual([]);
		expect(result.pastEvents).toEqual([]);
		expect(setResponseHeaders).toHaveBeenCalledOnce();
		const headers = setResponseHeaders.mock.calls[0]?.[0] as Headers;
		expect(headers.get("Cache-Control")).toBe(
			"public, s-maxage=60, stale-while-revalidate=300",
		);
		expect(headers.has("Vary")).toBe(false);
	});

	it("throws a 301 TanStack redirect to /organizers/$slug for slug-rename payloads", async () => {
		try {
			await resolvePublicOrganizerLoader({
				slug: "old-coimbatore",
				queryClient: queryClientReturning({
					kind: "redirect",
					newSlug: profile.slug,
				}),
			});
			expect.unreachable("Expected redirect to be thrown");
		} catch (error) {
			expect(isRedirect(error)).toBe(true);
			const redirectError = error as Response & {
				options: {
					to: string;
					params: { slug: string };
					code: number;
					replace: boolean;
				};
			};
			expect(redirectError.options.to).toBe("/organizers/$slug");
			expect(redirectError.options.params.slug).toBe(profile.slug);
			expect(redirectError.options.code).toBe(301);
			expect(redirectError.options.replace).toBe(true);
		}
	});

	it("throws a TanStack notFound when the API returns a 404", async () => {
		try {
			await resolvePublicOrganizerLoader({
				slug: "missing-organizer",
				queryClient: queryClientRejecting({ status: 404 }),
			});
			expect.unreachable("Expected notFound to be thrown");
		} catch (error) {
			expect(isNotFound(error)).toBe(true);
		}
	});

	it("re-throws non-404 errors so the route boundary surfaces a 500", async () => {
		const boom = Object.assign(new Error("Upstream blew up"), { status: 502 });

		await expect(
			resolvePublicOrganizerLoader({
				slug: profile.slug,
				queryClient: queryClientRejecting(boom),
			}),
		).rejects.toBe(boom);
	});

	it("does not set headers when no SSR header sink is passed (CSR navigation path)", async () => {
		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: queryClientReturning({ kind: "organizer", data: profile }),
		});

		expect(result.profile).toBe(profile);
		expect(result.upcomingEvents).toEqual([]);
		expect(result.pastEvents).toEqual([]);
	});

	it("rejects malformed slugs at the createServerFn validator boundary", async () => {
		// The route loader trusts the createServerFn input validator, which
		// runs `organizerSlugSchema.parse` before the API is touched. We
		// import the validator schema directly to assert its rejection
		// surface for inputs like `@bad!`.
		const { organizerSlugSchema } = await import("@repo/shared/schemas");
		expect(() => organizerSlugSchema.parse("@bad!")).toThrow();
		expect(() => organizerSlugSchema.parse("UPPER")).toThrow();
		expect(() => organizerSlugSchema.parse("")).toThrow();
		expect(() => organizerSlugSchema.parse("race-coimbatore")).not.toThrow();
	});
});

describe("/_public/organizers/$slug — OrganizerDetailView", () => {
	it("renders the profile and the upcoming events section with one card per event", () => {
		const upcomingEvents = [
			eventFixture(),
			eventFixture({
				slug: "coimbatore-half-marathon",
				title: "Coimbatore Half Marathon",
			}),
		];

		render(
			<OrganizerDetailView
				profile={profile}
				upcomingEvents={upcomingEvents}
				pastEvents={[]}
			/>,
		);

		expect(screen.getByText("Race Coimbatore Collective")).toBeTruthy();
		expect(
			screen.getByRole("heading", { level: 2, name: "Upcoming events" }),
		).toBeTruthy();
		expect(screen.getByText("Coimbatore City 10K")).toBeTruthy();
		expect(screen.getByText("Coimbatore Half Marathon")).toBeTruthy();
		expect(
			screen.queryByText(/has no upcoming events listed yet\./),
		).toBeNull();
	});

	it("renders the empty-state copy with the organizer name when no upcoming events are present", () => {
		render(
			<OrganizerDetailView
				profile={profile}
				upcomingEvents={[]}
				pastEvents={[]}
			/>,
		);

		expect(
			screen.getByText(
				"Race Coimbatore Collective has no upcoming events listed yet.",
			),
		).toBeTruthy();
	});

	it("renders both upcoming and past sections when both lists are populated", () => {
		const upcomingEvents = [eventFixture()];
		const pastEvents = [
			eventFixture({
				slug: "coimbatore-city-10k-2024",
				title: "Coimbatore City 10K 2024",
			}),
		];

		render(
			<OrganizerDetailView
				profile={profile}
				upcomingEvents={upcomingEvents}
				pastEvents={pastEvents}
			/>,
		);

		expect(
			screen.getByRole("heading", { level: 2, name: "Upcoming events" }),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { level: 2, name: "Past events" }),
		).toBeTruthy();
		expect(screen.getByText("Coimbatore City 10K")).toBeTruthy();
		expect(screen.getByText("Coimbatore City 10K 2024")).toBeTruthy();
		expect(screen.queryByText(/hasn't run any past events yet\./)).toBeNull();
		expect(
			screen.queryByText(/has no upcoming events listed yet\./),
		).toBeNull();
	});

	it("renders the past empty state alongside an upcoming list when past is empty", () => {
		const upcomingEvents = [eventFixture()];

		render(
			<OrganizerDetailView
				profile={profile}
				upcomingEvents={upcomingEvents}
				pastEvents={[]}
			/>,
		);

		expect(screen.getByText("Coimbatore City 10K")).toBeTruthy();
		expect(
			screen.getByText(
				"Race Coimbatore Collective hasn't run any past events yet.",
			),
		).toBeTruthy();
		expect(
			screen.queryByText(/has no upcoming events listed yet\./),
		).toBeNull();
	});
});
