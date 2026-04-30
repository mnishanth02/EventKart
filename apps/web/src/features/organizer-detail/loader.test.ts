import {
	type EventPublicCard,
	eventPublicCardSchema,
	organizerPublicProfileSchema,
} from "@repo/shared/schemas";
import type { QueryClient } from "@tanstack/react-query";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePublicOrganizerLoader } from "./loader";
import type {
	OrganizerPublicLookupResponse,
	OrganizerPublicProfile,
} from "./types";
import type { UpcomingEventsApiEnvelope } from "./upcoming-events-api.server";

const profile: OrganizerPublicProfile = organizerPublicProfileSchema.parse({
	slug: "race-coimbatore",
	businessName: "Race Coimbatore Collective",
	isVerified: true,
	city: "Coimbatore",
	description: "Endurance events from Coimbatore.",
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

const emptyEventsEnvelope: UpcomingEventsApiEnvelope = {
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
	queryFn: () => Promise<unknown>;
}

function makeQueryClient(handlers: {
	profile: () => Promise<OrganizerPublicLookupResponse>;
	events?: () => Promise<UpcomingEventsApiEnvelope>;
}): { client: QueryClient; ensureQueryData: ReturnType<typeof vi.fn> } {
	const ensureQueryData = vi.fn(async (options: QueryFn) => {
		const head = options.queryKey[0];
		if (head === "organizer-detail") {
			return handlers.profile();
		}
		if (head === "organizer-upcoming-events") {
			if (!handlers.events) {
				throw new Error("events handler not configured");
			}
			return handlers.events();
		}
		throw new Error(`Unexpected query key: ${String(head)}`);
	});
	const client = { ensureQueryData } as unknown as QueryClient;
	return { client, ensureQueryData };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	vi.restoreAllMocks();
});

describe("resolvePublicOrganizerLoader (I-2.3.2 — events prefetch)", () => {
	it("returns { profile, events } on the happy path", async () => {
		const events = [eventFixture()];
		const { client, ensureQueryData } = makeQueryClient({
			profile: async () => ({ kind: "organizer", data: profile }),
			events: async () => ({
				success: true,
				data: events,
				meta: { ...emptyEventsEnvelope.meta, total: 1, totalPages: 1 },
			}),
		});

		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: client,
		});

		expect(result.profile).toBe(profile);
		expect(result.events).toEqual(events);
		expect(ensureQueryData).toHaveBeenCalledTimes(2);
		expect(ensureQueryData.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				queryKey: ["organizer-detail", "by-slug", profile.slug],
			}),
		);
		expect(ensureQueryData.mock.calls[1]?.[0]).toEqual(
			expect.objectContaining({
				queryKey: [
					"organizer-upcoming-events",
					"list",
					{
						organizerSlug: profile.slug,
						page: 1,
						limit: 12,
						sort: "startAtAsc",
					},
				],
			}),
		);
	});

	it("returns events: [] (and logs a warning) when the events fetch rejects", async () => {
		const { client, ensureQueryData } = makeQueryClient({
			profile: async () => ({ kind: "organizer", data: profile }),
			events: async () => {
				throw new Error("upstream events failure");
			},
		});

		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: client,
		});

		expect(result.profile).toBe(profile);
		expect(result.events).toEqual([]);
		expect(ensureQueryData).toHaveBeenCalledTimes(2);
		expect(warnSpy).toHaveBeenCalled();
	});

	it("does NOT fetch events when the API throws a 301 slug-rename redirect", async () => {
		const eventsHandler = vi.fn();
		const { client, ensureQueryData } = makeQueryClient({
			profile: async () => ({ kind: "redirect", newSlug: profile.slug }),
			events: eventsHandler,
		});

		try {
			await resolvePublicOrganizerLoader({
				slug: "old-coimbatore",
				queryClient: client,
			});
			expect.unreachable("Expected redirect to be thrown");
		} catch (error) {
			expect(isRedirect(error)).toBe(true);
		}

		expect(eventsHandler).not.toHaveBeenCalled();
		expect(ensureQueryData).toHaveBeenCalledTimes(1);
	});

	it("does NOT fetch events when the profile lookup 404s", async () => {
		const eventsHandler = vi.fn();
		const { client, ensureQueryData } = makeQueryClient({
			profile: async () => {
				throw Object.assign(new Error("not found"), { status: 404 });
			},
			events: eventsHandler,
		});

		try {
			await resolvePublicOrganizerLoader({
				slug: "missing",
				queryClient: client,
			});
			expect.unreachable("Expected notFound to be thrown");
		} catch (error) {
			expect(isNotFound(error)).toBe(true);
		}

		expect(eventsHandler).not.toHaveBeenCalled();
		expect(ensureQueryData).toHaveBeenCalledTimes(1);
	});

	it("writes the SSR cache headers AFTER both fetches succeed", async () => {
		const setResponseHeaders = vi.fn();
		const { client } = makeQueryClient({
			profile: async () => ({ kind: "organizer", data: profile }),
			events: async () => emptyEventsEnvelope,
		});

		await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: client,
			setResponseHeaders,
		});

		expect(setResponseHeaders).toHaveBeenCalledOnce();
		const headers = setResponseHeaders.mock.calls[0]?.[0] as Headers;
		expect(headers.get("Cache-Control")).toBe(
			"public, s-maxage=60, stale-while-revalidate=300",
		);
	});
});
