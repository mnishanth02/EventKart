import { organizerSlugSchema } from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import type { OrganizerPublicLookupResponse } from "./types";

const publicOrganizerInputSchema = z.object({
	slug: organizerSlugSchema,
});

/**
 * Server function that resolves a public organizer profile by slug.
 *
 * - Validates the input slug with `organizerSlugSchema` (Zod) so SSR
 *   navigations to a malformed slug fail fast with a 400-equivalent
 *   instead of round-tripping to the API.
 * - Lazy-imports `./api.server` so the server-only `serverApiClient`
 *   never leaks into the client bundle (mirrors event-detail).
 *
 * Returns the discriminated lookup union so the loader can branch on
 * `kind === "redirect"` vs `kind === "organizer"`.
 */
export const getPublicOrganizer = createServerFn({ method: "GET" })
	.inputValidator((data) => publicOrganizerInputSchema.parse(data))
	.handler(async ({ data }): Promise<OrganizerPublicLookupResponse> => {
		const { getPublicOrganizerOnServer } = await import("./api.server");
		return getPublicOrganizerOnServer(data.slug);
	});
