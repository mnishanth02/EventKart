/**
 * Event server functions — safe to import from any code.
 * Server-only helpers are dynamically imported to keep them out of
 * the client bundle.
 */

import {
	createEventInputSchema,
	type CreateEventInput,
	type Event,
} from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";

export const createEvent = createServerFn({ method: "POST" })
	.inputValidator((data: CreateEventInput) =>
		createEventInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<Event> => {
		const { createEventOnServer } = await import("./api.server");
		const response = await createEventOnServer(data);
		return response.data;
	});
