import type { QueryClient } from "@tanstack/react-query";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { resolvePublicEventLoader } from "./loader";
import { eventPublicDetailSchema } from "@repo/shared/schemas";
import type { EventPublicDetail, EventPublicLookupResponse } from "./types";

const eventDetail: EventPublicDetail = eventPublicDetailSchema.parse({
	slug: "coimbatore-city-10k",
	title: "Coimbatore City 10K",
	description: "A public running event through Race Course.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road",
	addressLine2: null,
	city: "Coimbatore",
	state: "Tamil Nadu",
	country: "India",
	postalCode: "641018",
	timezone: "Asia/Kolkata",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: null,
	registrationClosesAt: null,
	routeDetails: "One loop around Race Course.",
	refundPolicy: null,
	cancellationPolicy: null,
	isPaid: true,
	currency: "INR",
	organizer: {
		slug: "race-coimbatore",
		businessName: "Race Coimbatore",
		isVerified: true,
		city: "Coimbatore",
	},
	heroImage: null,
	routeMapImage: null,
	categories: [],
	pricingTiers: [],
});

function queryClientReturning(payload: EventPublicLookupResponse): QueryClient {
	return {
		ensureQueryData: vi.fn().mockResolvedValue(payload),
	} as unknown as QueryClient;
}

function queryClientRejecting(error: unknown): QueryClient {
	return {
		ensureQueryData: vi.fn().mockRejectedValue(error),
	} as unknown as QueryClient;
}

describe("resolvePublicEventLoader", () => {
	it("returns event detail and sets public cache headers during SSR", async () => {
		const setResponseHeaders = vi.fn();

		const result = await resolvePublicEventLoader({
			slug: eventDetail.slug,
			queryClient: queryClientReturning({ kind: "event", data: eventDetail }),
			setResponseHeaders,
		});

		expect(result).toBe(eventDetail);
		expect(setResponseHeaders).toHaveBeenCalledOnce();
		const headers = setResponseHeaders.mock.calls[0]?.[0] as Headers;
		expect(headers.get("Cache-Control")).toBe(
			"public, s-maxage=60, stale-while-revalidate=300",
		);
		expect(headers.has("Vary")).toBe(false);
	});

	it("throws a permanent TanStack redirect for slug redirects", async () => {
		try {
			await resolvePublicEventLoader({
				slug: "old-coimbatore-10k",
				queryClient: queryClientReturning({
					kind: "redirect",
					newSlug: eventDetail.slug,
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
			expect(redirectError.options.to).toBe("/events/$slug");
			expect(redirectError.options.params.slug).toBe(eventDetail.slug);
			expect(redirectError.options.code).toBe(301);
			expect(redirectError.options.replace).toBe(true);
		}
	});

	it("throws a TanStack notFound object for API 404s", async () => {
		try {
			await resolvePublicEventLoader({
				slug: "missing-event",
				queryClient: queryClientRejecting({ status: 404 }),
			});
			expect.unreachable("Expected notFound to be thrown");
		} catch (error) {
			expect(isNotFound(error)).toBe(true);
		}
	});

	it("does not set headers when no SSR header sink is passed", async () => {
		await expect(
			resolvePublicEventLoader({
				slug: eventDetail.slug,
				queryClient: queryClientReturning({ kind: "event", data: eventDetail }),
			}),
		).resolves.toBe(eventDetail);
	});
});
