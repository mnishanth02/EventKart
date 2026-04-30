import { organizerSlugSchema } from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import type { PastEventsApiEnvelope } from "./past-events-api.server";

const pastEventsInputSchema = z.object({
	organizerSlug: organizerSlugSchema,
	page: z.number().int().min(1),
	limit: z.number().int().min(1).max(50),
	sort: z.enum(["startAtAsc", "startAtDesc"]),
});

/**
 * Server function that returns an organizer's past public events
 * (I-2.3.3).
 *
 * - Validates input with `organizerSlugSchema` so SSR navigations to a
 *   malformed slug fail before the API is touched.
 * - Lazy-imports `./past-events-api.server` so the server-only
 *   `serverApiClient` never leaks into the client bundle (mirrors the
 *   upcoming-events + events-discovery patterns).
 */
export const getOrganizerPastEvents = createServerFn({ method: "GET" })
	.inputValidator((data) => pastEventsInputSchema.parse(data))
	.handler(async ({ data }): Promise<PastEventsApiEnvelope> => {
		const { getOrganizerPastEventsOnServer } = await import(
			"./past-events-api.server"
		);
		return getOrganizerPastEventsOnServer(data);
	});
