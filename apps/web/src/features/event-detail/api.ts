import { eventSlugSchema } from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import type { EventPublicLookupResponse } from "./types";

const publicEventInputSchema = z.object({
	slug: eventSlugSchema,
});

export const getPublicEvent = createServerFn({ method: "GET" })
	.inputValidator((data) => publicEventInputSchema.parse(data))
	.handler(async ({ data }): Promise<EventPublicLookupResponse> => {
		const { getPublicEventOnServer } = await import("./api.server");
		const response = await getPublicEventOnServer(data.slug);
		return response.data;
	});
