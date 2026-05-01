import { z } from "zod/v4";
import { eventStatusSchema } from "../constants/event.js";
import { eventSchema } from "./event.js";
import { eventCategoryRecordSchema } from "./event-category.js";
import { eventPoliciesRecordSchema } from "./event-policy.js";
import {
	eventPublishTransitionSchema,
	publishReadinessSchema,
} from "./event-publish.js";
import { eventPricingTierWithCategorySchema } from "./event-pricing.js";
import { offsetPaginationSchema } from "./pagination.js";

export const adminEventReviewListParamsSchema = offsetPaginationSchema.extend({
	status: eventStatusSchema.default("under_review"),
});

export type AdminEventReviewListParams = z.infer<
	typeof adminEventReviewListParamsSchema
>;

export const adminEventReviewOrganizerSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	businessName: z.string(),
	contactName: z.string(),
	contactEmail: z.string(),
	city: z.string(),
	isVerified: z.boolean(),
	razorpayAccountStatus: z.string(),
	previouslyPublishedPaidEventCount: z.number().int().nonnegative(),
});

export type AdminEventReviewOrganizer = z.infer<
	typeof adminEventReviewOrganizerSchema
>;

export const adminEventReviewListItemSchema = z.object({
	eventId: z.string().uuid(),
	organizerId: z.string().uuid(),
	title: z.string(),
	slug: z.string(),
	status: eventStatusSchema,
	startAt: z.string(),
	submittedForReviewAt: z.string().nullable(),
	organizerBusinessName: z.string(),
	organizerContactEmail: z.string(),
	previouslyPublishedPaidEventCount: z.number().int().nonnegative(),
});

export type AdminEventReviewListItem = z.infer<
	typeof adminEventReviewListItemSchema
>;

export const adminEventReviewConfigurationSchema = z.object({
	categories: z.array(eventCategoryRecordSchema),
	pricingTiers: z.array(eventPricingTierWithCategorySchema),
	policies: eventPoliciesRecordSchema,
	readiness: publishReadinessSchema,
});

export type AdminEventReviewConfiguration = z.infer<
	typeof adminEventReviewConfigurationSchema
>;

export const adminEventReviewDetailSchema = z.object({
	event: eventSchema,
	organizer: adminEventReviewOrganizerSchema,
	configuration: adminEventReviewConfigurationSchema,
});

export type AdminEventReviewDetail = z.infer<
	typeof adminEventReviewDetailSchema
>;

export const adminEventApproveBodySchema = z.object({
	notes: z
		.string()
		.trim()
		.max(2000, "Notes must not exceed 2000 characters")
		.optional(),
});

export type AdminEventApproveBody = z.infer<typeof adminEventApproveBodySchema>;

export const adminEventRejectBodySchema = z.object({
	reason: z
		.string()
		.trim()
		.min(10, "Rejection reason must be at least 10 characters")
		.max(2000, "Rejection reason must not exceed 2000 characters"),
});

export type AdminEventRejectBody = z.infer<typeof adminEventRejectBodySchema>;

export const adminEventReviewActionResponseSchema = z.object({
	event: eventSchema,
	transition: eventPublishTransitionSchema,
	reviewedAt: z.string(),
	reviewedBy: z.string().uuid(),
});

export type AdminEventReviewActionResponse = z.infer<
	typeof adminEventReviewActionResponseSchema
>;
