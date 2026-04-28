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
	type EventImage,
	type EventImageKind,
	type EventImageListQuery,
	type EventImageUploadUrlRequest,
	type EventImageUploadUrlResponse,
	type EventPoliciesConfigInput,
	type EventPoliciesRecord,
	type EventPricingConfigInput,
	type EventPricingTierWithCategory,
	type EventRegistrationForm,
	type EventRegistrationFormInput,
	eventCategoriesConfigSchema,
	eventImageConfirmRequestSchema,
	eventImageDeleteRequestSchema,
	eventImageListQuerySchema,
	eventImageUploadUrlRequestSchema,
	eventPoliciesConfigSchema,
	eventPricingConfigSchema,
	eventRegistrationFormSchema,
	type PublishEventResponse,
	type PublishReadiness,
	type UnpublishEventResponse,
	uuidSchema,
} from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { type EventUpdatePayload, eventEditValuesSchema } from "./form-values";

const eventIdInputSchema = z.object({
	eventId: uuidSchema,
});

const updateEventInputSchema = z.object({
	eventId: uuidSchema,
	event: eventEditValuesSchema,
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

const updateEventRegistrationFormInputSchema = z.object({
	eventId: uuidSchema,
	config: eventRegistrationFormSchema,
});

const getEventImagesInputSchema = eventIdInputSchema.extend({
	kind: eventImageListQuerySchema.shape.kind,
	status: eventImageListQuerySchema.shape.status,
});

const requestEventImageUploadUrlInputSchema = eventIdInputSchema.extend(
	eventImageUploadUrlRequestSchema.shape,
);

const eventImageMutationInputSchema = eventIdInputSchema.extend({
	imageId: eventImageConfirmRequestSchema.shape.imageId,
});

const deleteEventImageInputSchema = eventIdInputSchema.extend({
	imageId: eventImageDeleteRequestSchema.shape.imageId,
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
export type GetEventRegistrationFormInput = z.input<typeof eventIdInputSchema>;
export type UpdateEventRegistrationFormInput = {
	eventId: string;
	config: EventRegistrationFormInput;
};
export type GetEventImagesInput = z.input<typeof getEventImagesInputSchema>;
export type RequestEventImageUploadUrlInput = {
	eventId: string;
} & EventImageUploadUrlRequest;
export type ConfirmEventImageUploadInput = z.input<
	typeof eventImageMutationInputSchema
>;
export type DeleteEventImageInput = z.input<typeof deleteEventImageInputSchema>;
export type DeleteEventImageResult = {
	deleted: true;
	imageId: string;
	kind: EventImageKind;
};

export type GetEventInput = z.input<typeof eventIdInputSchema>;
export type UpdateEventInput = {
	eventId: string;
	event: EventUpdatePayload;
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

export const getEvent = createServerFn({ method: "GET" })
	.inputValidator((data: GetEventInput) => eventIdInputSchema.parse(data))
	.handler(async ({ data }): Promise<Event> => {
		const { getEventOnServer } = await import("./api.server");
		const response = await getEventOnServer(data.eventId);
		return response.data;
	});

export const getPublishReadiness = createServerFn({ method: "GET" })
	.inputValidator((data: GetEventInput) => eventIdInputSchema.parse(data))
	.handler(async ({ data }): Promise<PublishReadiness> => {
		const { getPublishReadinessOnServer } = await import("./api.server");
		const response = await getPublishReadinessOnServer(data.eventId);
		return response.data;
	});

export const publishEvent = createServerFn({ method: "POST" })
	.inputValidator((data: GetEventInput) => eventIdInputSchema.parse(data))
	.handler(async ({ data }): Promise<PublishEventResponse["data"]> => {
		const { publishEventOnServer } = await import("./api.server");
		const response = await publishEventOnServer(data.eventId);
		return response.data;
	});

export const unpublishEvent = createServerFn({ method: "POST" })
	.inputValidator((data: GetEventInput) => eventIdInputSchema.parse(data))
	.handler(async ({ data }): Promise<UnpublishEventResponse["data"]> => {
		const { unpublishEventOnServer } = await import("./api.server");
		const response = await unpublishEventOnServer(data.eventId);
		return response.data;
	});

export const updateEvent = createServerFn({ method: "POST" })
	.inputValidator((data: UpdateEventInput) =>
		updateEventInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<Event> => {
		const { updateEventOnServer } = await import("./api.server");
		const response = await updateEventOnServer(data.eventId, data.event);
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

export const getEventRegistrationForm = createServerFn({ method: "GET" })
	.inputValidator((data: GetEventRegistrationFormInput) =>
		eventIdInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventRegistrationForm> => {
		const { getEventRegistrationFormOnServer } = await import("./api.server");
		const response = await getEventRegistrationFormOnServer(data.eventId);
		return response.data.formSchema;
	});

export const updateEventRegistrationForm = createServerFn({ method: "POST" })
	.inputValidator((data: UpdateEventRegistrationFormInput) =>
		updateEventRegistrationFormInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventRegistrationForm> => {
		const { updateEventRegistrationFormOnServer } = await import(
			"./api.server"
		);
		const response = await updateEventRegistrationFormOnServer(
			data.eventId,
			data.config,
		);
		return response.data.formSchema;
	});

export const getEventImages = createServerFn({ method: "GET" })
	.inputValidator((data: GetEventImagesInput) =>
		getEventImagesInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventImage[]> => {
		const { listEventImagesOnServer } = await import("./api.server");
		const query: EventImageListQuery = {};
		if (data.kind) query.kind = data.kind;
		if (data.status) query.status = data.status;
		const response = await listEventImagesOnServer(data.eventId, query);
		return response.data.images;
	});

export const requestEventImageUploadUrl = createServerFn({ method: "POST" })
	.inputValidator((data: RequestEventImageUploadUrlInput) =>
		requestEventImageUploadUrlInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventImageUploadUrlResponse> => {
		const { requestEventImageUploadUrlOnServer } = await import("./api.server");
		const { eventId, ...request } = data;
		const response = await requestEventImageUploadUrlOnServer(eventId, request);
		return response.data;
	});

export const confirmEventImageUpload = createServerFn({ method: "POST" })
	.inputValidator((data: ConfirmEventImageUploadInput) =>
		eventImageMutationInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventImage> => {
		const { confirmEventImageUploadOnServer } = await import("./api.server");
		const response = await confirmEventImageUploadOnServer(
			data.eventId,
			data.imageId,
		);
		return response.data;
	});

export const deleteEventImage = createServerFn({ method: "POST" })
	.inputValidator((data: DeleteEventImageInput) =>
		deleteEventImageInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<DeleteEventImageResult> => {
		const { deleteEventImageOnServer } = await import("./api.server");
		const response = await deleteEventImageOnServer(data.eventId, data.imageId);
		return response.data;
	});
