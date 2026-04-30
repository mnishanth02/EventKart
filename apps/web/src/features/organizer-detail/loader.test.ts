import {
	type EventPublicCard,
	eventPublicCardSchema,
	organizerPublicProfileSchema,
} from "@repo/shared/schemas";
import type { QueryClient } from "@tanstack/react-query";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePublicOrganizerLoader } from "./loader";
import type { PastEventsApiEnvelope } from "./past-events-api.server";
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
	queryFn: () => Promise<unknown>;
}

interface MakeQueryClientHandlers {
	profile: () => Promise<OrganizerPublicLookupResponse>;
	upcoming?: () => Promise<UpcomingEventsApiEnvelope>;
	past?: () => Promise<PastEventsApiEnvelope>;
}

function makeQueryClient(handlers: MakeQueryClientHandlers): {
	client: QueryClient;
	ensureQueryData: ReturnType<typeof vi.fn>;
	upcomingHandler: ReturnType<typeof vi.fn>;
	pastHandler: ReturnType<typeof vi.fn>;
} {
	const upcomingHandler = vi.fn(async () => {
		if (!handlers.upcoming) {
			throw new Error("upcoming handler not configured");
		}
		return handlers.upcoming();
	});
	const pastHandler = vi.fn(async () => {
		if (!handlers.past) {
			throw new Error("past handler not configured");
		}
		return handlers.past();
	});
	const ensureQueryData = vi.fn(async (options: QueryFn) => {
		const head = options.queryKey[0];
		if (head === "organizer-detail") {
			return handlers.profile();
		}
		if (head === "organizer-upcoming-events") {
			return upcomingHandler();
		}
		if (head === "organizer-past-events") {
			return pastHandler();
		}
		throw new Error(`Unexpected query key: ${String(head)}`);
	});
	const client = { ensureQueryData } as unknown as QueryClient;
	return { client, ensureQueryData, upcomingHandler, pastHandler };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	vi.restoreAllMocks();
});

describe("resolvePublicOrganizerLoader (I-2.3.2 + I-2.3.3 — events prefetch)", () => {
	it("returns { profile, upcomingEvents, pastEvents } on the happy path with both lists populated", async () => {
		const upcoming = [eventFixture()];
		const past = [
			eventFixture({ slug: "coimbatore-2024", title: "Coimbatore 2024" }),
		];
		const { client, ensureQueryData, upcomingHandler, pastHandler } =
			makeQueryClient({
				profile: async () => ({ kind: "organizer", data: profile }),
				upcoming: async () => ({
					success: true,
					data: upcoming,
					meta: { ...emptyUpcomingEnvelope.meta, total: 1, totalPages: 1 },
				}),
				past: async () => ({
					success: true,
					data: past,
					meta: { ...emptyPastEnvelope.meta, total: 1, totalPages: 1 },
				}),
			});

		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: client,
		});

		expect(result.profile).toBe(profile);
		expect(result.upcomingEvents).toEqual(upcoming);
		expect(result.pastEvents).toEqual(past);
		expect(ensureQueryData).toHaveBeenCalledTimes(3);
		expect(upcomingHandler).toHaveBeenCalledOnce();
		expect(pastHandler).toHaveBeenCalledOnce();
		// Profile is dispatched first.
		expect(ensureQueryData.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				queryKey: ["organizer-detail", "by-slug", profile.slug],
			}),
		);
		// Both events queries are dispatched after the profile (order
		// within Promise.all is not guaranteed, so assert on the set).
		const eventQueryKeys = ensureQueryData.mock.calls
			.slice(1)
			.map((call) => (call[0] as QueryFn).queryKey);
		expect(eventQueryKeys).toEqual(
			expect.arrayContaining([
				[
					"organizer-upcoming-events",
					"list",
					{
						organizerSlug: profile.slug,
						page: 1,
						limit: 12,
						sort: "startAtAsc",
					},
				],
				[
					"organizer-past-events",
					"list",
					{
						organizerSlug: profile.slug,
						page: 1,
						limit: 12,
						sort: "startAtDesc",
					},
				],
			]),
		);
	});

	it("returns upcomingEvents: [] (and logs a warning) when the upcoming fetch rejects but past succeeds", async () => {
		const past = [eventFixture({ slug: "old", title: "Old race" })];
		const { client, upcomingHandler, pastHandler } = makeQueryClient({
			profile: async () => ({ kind: "organizer", data: profile }),
			upcoming: async () => {
				throw new Error("upstream upcoming failure");
			},
			past: async () => ({
				success: true,
				data: past,
				meta: { ...emptyPastEnvelope.meta, total: 1, totalPages: 1 },
			}),
		});

		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: client,
		});

		expect(result.profile).toBe(profile);
		expect(result.upcomingEvents).toEqual([]);
		expect(result.pastEvents).toEqual(past);
		expect(upcomingHandler).toHaveBeenCalledOnce();
		expect(pastHandler).toHaveBeenCalledOnce();
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).toContain("upcoming events fetch failed");
	});

	it("returns pastEvents: [] (and logs ONE warning) when the past fetch rejects but upcoming succeeds", async () => {
		const upcoming = [eventFixture()];
		const { client, upcomingHandler, pastHandler } = makeQueryClient({
			profile: async () => ({ kind: "organizer", data: profile }),
			upcoming: async () => ({
				success: true,
				data: upcoming,
				meta: { ...emptyUpcomingEnvelope.meta, total: 1, totalPages: 1 },
			}),
			past: async () => {
				throw new Error("upstream past failure");
			},
		});

		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: client,
		});

		expect(result.profile).toBe(profile);
		expect(result.upcomingEvents).toEqual(upcoming);
		expect(result.pastEvents).toEqual([]);
		expect(upcomingHandler).toHaveBeenCalledOnce();
		expect(pastHandler).toHaveBeenCalledOnce();
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).toContain("past events fetch failed");
	});

	it("returns BOTH lists empty (and logs TWO warnings) when both event fetches reject", async () => {
		const { client, upcomingHandler, pastHandler } = makeQueryClient({
			profile: async () => ({ kind: "organizer", data: profile }),
			upcoming: async () => {
				throw new Error("upcoming boom");
			},
			past: async () => {
				throw new Error("past boom");
			},
		});

		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: client,
		});

		expect(result.upcomingEvents).toEqual([]);
		expect(result.pastEvents).toEqual([]);
		expect(upcomingHandler).toHaveBeenCalledOnce();
		expect(pastHandler).toHaveBeenCalledOnce();
		expect(warnSpy).toHaveBeenCalledTimes(2);
		const warnMessages = warnSpy.mock.calls.map((call: unknown[]) =>
			String(call[0]),
		);
		expect(
			warnMessages.some((m: string) =>
				m.includes("upcoming events fetch failed"),
			),
		).toBe(true);
		expect(
			warnMessages.some((m: string) =>
				m.includes("past events fetch failed"),
			),
		).toBe(true);
	});

	it("does NOT fetch upcoming or past events when the API throws a 301 slug-rename redirect", async () => {
		const { client, ensureQueryData, upcomingHandler, pastHandler } =
			makeQueryClient({
				profile: async () => ({ kind: "redirect", newSlug: profile.slug }),
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

		expect(upcomingHandler).not.toHaveBeenCalled();
		expect(pastHandler).not.toHaveBeenCalled();
		expect(ensureQueryData).toHaveBeenCalledTimes(1);
	});

	it("does NOT fetch upcoming or past events when the profile lookup 404s", async () => {
		const { client, ensureQueryData, upcomingHandler, pastHandler } =
			makeQueryClient({
				profile: async () => {
					throw Object.assign(new Error("not found"), { status: 404 });
				},
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

		expect(upcomingHandler).not.toHaveBeenCalled();
		expect(pastHandler).not.toHaveBeenCalled();
		expect(ensureQueryData).toHaveBeenCalledTimes(1);
	});

	it("writes the SSR cache headers AFTER profile + upcoming + past all succeed", async () => {
		const setResponseHeaders = vi.fn();
		const { client, ensureQueryData } = makeQueryClient({
			profile: async () => ({ kind: "organizer", data: profile }),
			upcoming: async () => emptyUpcomingEnvelope,
			past: async () => emptyPastEnvelope,
		});

		await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: client,
			setResponseHeaders,
		});

		// Three fetches must precede the header write.
		expect(ensureQueryData).toHaveBeenCalledTimes(3);
		expect(setResponseHeaders).toHaveBeenCalledOnce();
		const headers = setResponseHeaders.mock.calls[0]?.[0] as Headers;
		expect(headers.get("Cache-Control")).toBe(
			"public, s-maxage=60, stale-while-revalidate=300",
		);
	});
});
