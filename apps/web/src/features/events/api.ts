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
	type EventPoliciesConfigInput,
	type EventPoliciesRecord,
	type EventPricingConfigInput,
	type EventPricingTierWithCategory,
	eventCategoriesConfigSchema,
	eventPoliciesConfigSchema,
	eventPricingConfigSchema,
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

const updateEventPricingInputSchema = z.object({
	eventId: uuidSchema,
	config: eventPricingConfigSchema,
});

const updateEventPoliciesInputSchema = z.object({
	eventId: uuidSchema,
	config: eventPoliciesConfigSchema,
});

export type GetEventCategoriesInput = z.input<typeof eventIdInputSchema>;
export type UpdateEventCategoriesInput = {
	eventId: string;
	config: EventCategoriesConfigInput;
};
export type GetEventPricingInput = z.input<typeof eventIdInputSchema>;
export type UpdateEventPricingInput = {
	eventId: string;
	config: EventPricingConfigInput;
};
export type GetEventPoliciesInput = z.input<typeof eventIdInputSchema>;
export type UpdateEventPoliciesInput = {
	eventId: string;
	config: EventPoliciesConfigInput;
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

export const getEventPolicies = createServerFn({ method: "GET" })
	.inputValidator((data: GetEventPoliciesInput) =>
		eventIdInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventPoliciesRecord> => {
		const { getEventPoliciesOnServer } = await import("./api.server");
		const response = await getEventPoliciesOnServer(data.eventId);
		return response.data;
	});

export const updateEventPolicies = createServerFn({ method: "POST" })
	.inputValidator((data: UpdateEventPoliciesInput) =>
		updateEventPoliciesInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventPoliciesRecord> => {
		const { updateEventPoliciesOnServer } = await import("./api.server");
		const response = await updateEventPoliciesOnServer(
			data.eventId,
			data.config,
		);
		return response.data;
	});

export const getEventPricing = createServerFn({ method: "GET" })
	.inputValidator((data: GetEventPricingInput) =>
		eventIdInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventPricingTierWithCategory[]> => {
		const { listEventPricingOnServer } = await import("./api.server");
		const response = await listEventPricingOnServer(data.eventId);
		return response.data.tiers;
	});

export const updateEventPricing = createServerFn({ method: "POST" })
	.inputValidator((data: UpdateEventPricingInput) =>
		updateEventPricingInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventPricingTierWithCategory[]> => {
		const { replaceEventPricingOnServer } = await import("./api.server");
		const response = await replaceEventPricingOnServer(
			data.eventId,
			data.config,
		);
		return response.data.tiers;
	});
