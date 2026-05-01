import { organizerSlugSchema } from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import type { UpcomingEventsApiEnvelope } from "./upcoming-events-api.server";

const upcomingEventsInputSchema = z.object({
	organizerSlug: organizerSlugSchema,
	page: z.number().int().min(1),
	limit: z.number().int().min(1).max(50),
	sort: z.enum(["startAtAsc", "startAtDesc"]),
});

/**
 * Server function that returns an organizer's upcoming public events
 * (I-2.3.2).
 *
 * - Validates input with `organizerSlugSchema` so SSR navigations to a
 *   malformed slug fail before the API is touched.
 * - Lazy-imports `./upcoming-events-api.server` so the server-only
 *   `serverApiClient` never leaks into the client bundle (mirrors the
 *   events-discovery + organizer-detail patterns).
 */
export const getOrganizerUpcomingEvents = createServerFn({ method: "GET" })
	.inputValidator((data) => upcomingEventsInputSchema.parse(data))
	.handler(async ({ data }): Promise<UpcomingEventsApiEnvelope> => {
		const { getOrganizerUpcomingEventsOnServer } = await import(
			"./upcoming-events-api.server"
		);
		return getOrganizerUpcomingEventsOnServer(data);
	});
