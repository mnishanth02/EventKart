import { organizerPublicProfileSchema } from "@repo/shared/schemas";
import type { QueryClient } from "@tanstack/react-query";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { resolvePublicOrganizerLoader } from "#/features/organizer-detail/loader";
import type {
	OrganizerPublicLookupResponse,
	OrganizerPublicProfile,
} from "#/features/organizer-detail/types";

const profileInput = {
	slug: "race-coimbatore",
	businessName: "Race Coimbatore Collective",
	isVerified: true,
	city: "Coimbatore",
	description: "Endurance events from Coimbatore.",
} as const;

const profile: OrganizerPublicProfile =
	organizerPublicProfileSchema.parse(profileInput);

function queryClientReturning(
	payload: OrganizerPublicLookupResponse,
): QueryClient {
	return {
		ensureQueryData: vi.fn().mockResolvedValue(payload),
	} as unknown as QueryClient;
}

function queryClientRejecting(error: unknown): QueryClient {
	return {
		ensureQueryData: vi.fn().mockRejectedValue(error),
	} as unknown as QueryClient;
}

describe("/_public/organizers/$slug — resolvePublicOrganizerLoader", () => {
	it("returns the organizer profile and writes the public CDN cache headers", async () => {
		const setResponseHeaders = vi.fn();

		const result = await resolvePublicOrganizerLoader({
			slug: profile.slug,
			queryClient: queryClientReturning({ kind: "organizer", data: profile }),
			setResponseHeaders,
		});

		expect(result).toBe(profile);
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
		await expect(
			resolvePublicOrganizerLoader({
				slug: profile.slug,
				queryClient: queryClientReturning({ kind: "organizer", data: profile }),
			}),
		).resolves.toBe(profile);
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
