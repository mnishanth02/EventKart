import { z } from "zod/v4";
import { eventStatusSchema } from "../constants/event.js";
import { eventSchema } from "./event.js";

export const publishReadinessCheckSchema = z.enum([
	"organizer_verified",
	"razorpay_linked",
	"categories_configured",
	"pricing_configured",
	"active_pricing",
	"hero_image_uploaded",
	"refund_policy_configured",
	"cancellation_policy_configured",
	"event_starts_in_future",
	"event_ends_in_future",
	"slug_available",
]);

export const publishReadinessItemSchema = z.object({
	check: publishReadinessCheckSchema,
	passed: z.boolean(),
	message: z.string(),
	severity: z.enum(["error", "warning", "info"]).default("error"),
});

export const publishReadinessSchema = z.object({
	ready: z.boolean(),
	eventStatus: eventStatusSchema,
	isPaid: z.boolean(),
	requiresRazorpay: z.boolean(),
	wouldRequireAdminReview: z.boolean(),
	items: z.array(publishReadinessItemSchema),
});

export const eventPublishTransitionSchema = z.enum([
	"draft_to_published",
	"draft_to_under_review",
	"published_to_draft",
	"under_review_to_published",
	"under_review_to_draft",
	"noop_already_published",
	"noop_already_under_review",
]);

export const publishReadinessResponseSchema = z.object({
	success: z.literal(true),
	data: publishReadinessSchema,
});

export const publishEventResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		event: eventSchema,
		transition: eventPublishTransitionSchema,
		readiness: publishReadinessSchema,
	}),
});

export const unpublishEventResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		event: eventSchema,
		transition: eventPublishTransitionSchema,
	}),
});

export type PublishReadinessCheck = z.infer<typeof publishReadinessCheckSchema>;
export type PublishReadinessItem = z.infer<typeof publishReadinessItemSchema>;
export type PublishReadiness = z.infer<typeof publishReadinessSchema>;
export type EventPublishTransition = z.infer<
	typeof eventPublishTransitionSchema
>;
export type PublishEventResponse = z.infer<typeof publishEventResponseSchema>;
export type UnpublishEventResponse = z.infer<
	typeof unpublishEventResponseSchema
>;
