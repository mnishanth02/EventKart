/**
 * Event server functions — safe to import from any code.
 * Server-only helpers are dynamically imported to keep them out of
 * the client bundle.
 */

import {
	type CreateEventInput,
	createEventInputSchema,
	type Event,
	type EventCategoriesConfigInput,
	type EventCategoryRecord,
	eventCategoriesConfigSchema,
	uuidSchema,
} from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";

const eventIdInputSchema = z.object({
	eventId: uuidSchema,
});

const updateEventCategoriesInputSchema = z.object({
	eventId: uuidSchema,
	config: eventCategoriesConfigSchema,
});

export type GetEventCategoriesInput = z.input<typeof eventIdInputSchema>;
export type UpdateEventCategoriesInput = {
	eventId: string;
	config: EventCategoriesConfigInput;
};

export const createEvent = createServerFn({ method: "POST" })
	.inputValidator((data: CreateEventInput) =>
		createEventInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<Event> => {
		const { createEventOnServer } = await import("./api.server");
		const response = await createEventOnServer(data);
		return response.data;
	});

export const getEventCategories = createServerFn({ method: "GET" })
	.inputValidator((data: GetEventCategoriesInput) =>
		eventIdInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventCategoryRecord[]> => {
		const { listEventCategoriesOnServer } = await import("./api.server");
		const response = await listEventCategoriesOnServer(data.eventId);
		return response.data.categories;
	});

export const updateEventCategories = createServerFn({ method: "POST" })
	.inputValidator((data: UpdateEventCategoriesInput) =>
		updateEventCategoriesInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventCategoryRecord[]> => {
		const { replaceEventCategoriesOnServer } = await import("./api.server");
		const response = await replaceEventCategoriesOnServer(
			data.eventId,
			data.config,
		);
		return response.data.categories;
	});
