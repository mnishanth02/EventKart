import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { createAuditLogger } from "../../lib/audit.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import {
	confirmEventImageUpload,
	deleteEventImage,
	listEventImages,
	requestEventImageUpload,
} from "./event-image-service.js";
import {
	createEventBodySchema,
	createEventResponseSchema,
	eventCategoriesBodySchema,
	eventCategoriesResponseSchema,
	eventCategoryCapacityBodySchema,
	eventCategoryCapacityResponseSchema,
	eventCategoryIdParamsSchema,
	eventErrorResponseSchema,
	eventIdParamsSchema,
	eventImageConfirmResponseSchema,
	eventImageDeleteResponseSchema,
	eventImageIdParamsSchema,
	eventImagesListResponseSchema,
	eventImagesQuerySchema,
	eventImageUploadBodySchema,
	eventImageUploadResponseSchema,
	eventPoliciesBodySchema,
	eventPoliciesResponseSchema,
	eventPricingBodySchema,
	eventPricingResponseSchema,
	eventPublicLookupHttpResponseSchema,
	eventRegistrationFormBodySchema,
	eventRegistrationFormResponseSchema,
	eventSlugParamsSchema,
	publicEventListQuerySchema,
	publicEventListResponseSchema,
	publishedEventPatchBodySchema,
	publishedEventPatchResponseSchema,
	publishEventResponseSchema,
	publishReadinessResponseSchema,
	unpublishEventResponseSchema,
	updateEventBodySchema,
	updateEventResponseSchema,
} from "./schemas.js";
import { lookupPublicEventBySlug } from "./public-detail-service.js";
import { listPublicEvents } from "./public-listing-service.js";
import {
	createDraftEvent,
	getEvent,
	getEventPolicies,
	getEventRegistrationForm,
	getPublishReadiness,
	listEventCategories,
	listEventPricing,
	publishEvent,
	replaceEventCategories,
	replaceEventPricing,
	unpublishEvent,
	updateDraftEvent,
	updateEventCategoryCapacity,
	updateEventPolicies,
	updateEventRegistrationForm,
	updatePublishedEvent,
} from "./service.js";

const eventRoutes: FastifyPluginAsync = async (app) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	typedApp.post(
		"/",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				body: createEventBodySchema,
				response: {
					201: createEventResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const event = await createDraftEvent(
				{ db: app.db, log: request.log },
				session.userId,
				request.body,
			);

			reply.code(201);
			return { success: true as const, data: event };
		},
	);

	typedApp.put(
		"/:eventId",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				body: updateEventBodySchema,
				response: {
					200: updateEventResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const event = await updateDraftEvent(
				{ db: app.db, log: request.log },
				session.userId,
				request.params.eventId,
				request.body,
			);

			return { success: true as const, data: event };
		},
	);

	typedApp.get(
		"/:eventId/publish-readiness",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				response: {
					200: publishReadinessResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const readiness = await getPublishReadiness(
				app.db,
				session.userId,
				request.params.eventId,
			);

			return { success: true as const, data: readiness };
		},
	);

	typedApp.post(
		"/:eventId/publish",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				response: {
					200: publishEventResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await publishEvent(
				{ db: app.db, log: request.log, auditLogger },
				session.userId,
				request.params.eventId,
				request.ip,
			);

			return { success: true as const, data: result };
		},
	);

	typedApp.post(
		"/:eventId/unpublish",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				response: {
					200: unpublishEventResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await unpublishEvent(
				{ db: app.db, log: request.log, auditLogger },
				session.userId,
				request.params.eventId,
				request.ip,
			);

			return { success: true as const, data: result };
		},
	);

	typedApp.get(
		"/by-slug/:slug",
		{
			schema: {
				params: eventSlugParamsSchema,
				response: {
					200: eventPublicLookupHttpResponseSchema,
					400: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const data = await lookupPublicEventBySlug(
				{
					db: app.db,
					storage: app.storage,
					log: request.log,
					featureFlags: {
						spotsRemainingEnabled:
							app.config.PUBLIC_SPOTS_REMAINING_BADGE_ENABLED ?? false,
					},
				},
				request.params.slug,
			);

			return { success: true as const, data };
		},
	);

	// Must register before "/:eventId" so Fastify does not match eventId="public".
	typedApp.get(
		"/public",
		{
			schema: {
				querystring: publicEventListQuerySchema,
				response: {
					200: publicEventListResponseSchema,
					400: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const result = await listPublicEvents(
				{
					db: app.db,
					storage: app.storage,
					log: request.log,
					featureFlags: {
						spotsRemainingEnabled:
							app.config.PUBLIC_SPOTS_REMAINING_BADGE_ENABLED ?? false,
					},
				},
				{ ...request.query, now: new Date() },
			);

			return {
				success: true as const,
				data: result.data,
				meta: result.meta,
			};
		},
	);

	typedApp.get(
		"/:eventId",
		{
			schema: {
				params: eventIdParamsSchema,
				response: {
					200: createEventResponseSchema,
					400: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const event = await getEvent(
				app.db,
				request.params.eventId,
				request.session?.role === "organizer"
					? request.session.userId
					: undefined,
			);

			return { success: true as const, data: event };
		},
	);

	typedApp.get(
		"/:eventId/categories",
		{
			schema: {
				params: eventIdParamsSchema,
				response: {
					200: eventCategoriesResponseSchema,
					400: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const categories = await listEventCategories(
				app.db,
				request.params.eventId,
				request.session?.role === "organizer"
					? request.session.userId
					: undefined,
			);

			return { success: true as const, data: { categories } };
		},
	);

	typedApp.put(
		"/:eventId/categories",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				body: eventCategoriesBodySchema,
				response: {
					200: eventCategoriesResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const categories = await replaceEventCategories(
				{ db: app.db, log: request.log },
				session.userId,
				request.params.eventId,
				request.body,
			);

			return { success: true as const, data: { categories } };
		},
	);

	typedApp.get(
		"/:eventId/policies",
		{
			schema: {
				params: eventIdParamsSchema,
				response: {
					200: eventPoliciesResponseSchema,
					400: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const policies = await getEventPolicies(
				app.db,
				request.params.eventId,
				request.session?.role === "organizer"
					? request.session.userId
					: undefined,
			);

			return { success: true as const, data: policies };
		},
	);

	typedApp.put(
		"/:eventId/policies",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				body: eventPoliciesBodySchema,
				response: {
					200: eventPoliciesResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const policies = await updateEventPolicies(
				{
					db: app.db,
					log: request.log,
					auditLogger: createAuditLogger(app.db, request.log),
				},
				session.userId,
				request.params.eventId,
				request.body,
			);

			return { success: true as const, data: policies };
		},
	);

	typedApp.patch(
		"/:eventId/published",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				body: publishedEventPatchBodySchema,
				response: {
					200: publishedEventPatchResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const event = await updatePublishedEvent(
				{
					db: app.db,
					log: request.log,
					auditLogger: createAuditLogger(app.db, request.log),
				},
				session.userId,
				request.params.eventId,
				request.body,
			);

			return { success: true as const, data: event };
		},
	);

	typedApp.patch(
		"/:eventId/categories/:categoryId/capacity",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventCategoryIdParamsSchema,
				body: eventCategoryCapacityBodySchema,
				response: {
					200: eventCategoryCapacityResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const category = await updateEventCategoryCapacity(
				{ db: app.db, log: request.log },
				session.userId,
				request.params.eventId,
				request.params.categoryId,
				request.body,
			);

			return { success: true as const, data: category };
		},
	);

	typedApp.get(
		"/:eventId/registration-form",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				response: {
					200: eventRegistrationFormResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const registrationForm = await getEventRegistrationForm(
				app.db,
				session.userId,
				request.params.eventId,
			);

			return { success: true as const, data: registrationForm };
		},
	);

	typedApp.put(
		"/:eventId/registration-form",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				body: eventRegistrationFormBodySchema,
				response: {
					200: eventRegistrationFormResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const registrationForm = await updateEventRegistrationForm(
				{ db: app.db, log: request.log },
				session.userId,
				request.params.eventId,
				request.body,
			);

			return { success: true as const, data: registrationForm };
		},
	);

	typedApp.get(
		"/:eventId/pricing",
		{
			schema: {
				params: eventIdParamsSchema,
				response: {
					200: eventPricingResponseSchema,
					400: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const tiers = await listEventPricing(
				app.db,
				request.params.eventId,
				request.session?.role === "organizer"
					? request.session.userId
					: undefined,
			);

			return { success: true as const, data: { tiers } };
		},
	);

	typedApp.put(
		"/:eventId/pricing",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				body: eventPricingBodySchema,
				response: {
					200: eventPricingResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
					409: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			const tiers = await replaceEventPricing(
				{ db: app.db, log: request.log },
				session.userId,
				request.params.eventId,
				request.body,
			);

			return { success: true as const, data: { tiers } };
		},
	);

	typedApp.post(
		"/:eventId/images/upload-url",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventIdParamsSchema,
				body: eventImageUploadBodySchema,
				response: {
					200: eventImageUploadResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			if (!app.storage.enabled) {
				throw new ValidationError(
					"Event image upload is not available at this time",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await requestEventImageUpload(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				session.userId,
				request.params.eventId,
				request.body,
				request.ip,
			);

			return { success: true as const, data: result };
		},
	);

	typedApp.post(
		"/:eventId/images/:imageId/confirm",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventImageIdParamsSchema,
				response: {
					200: eventImageConfirmResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			if (!app.storage.enabled) {
				throw new ValidationError(
					"Event image upload is not available at this time",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await confirmEventImageUpload(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				session.userId,
				request.params.eventId,
				request.params.imageId,
				request.ip,
			);

			return { success: true as const, data: result };
		},
	);

	typedApp.get(
		"/:eventId/images",
		{
			schema: {
				params: eventIdParamsSchema,
				querystring: eventImagesQuerySchema,
				response: {
					200: eventImagesListResponseSchema,
					400: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const result = await listEventImages(
				app.db,
				request.params.eventId,
				request.query,
				request.session?.role === "organizer"
					? request.session.userId
					: undefined,
			);

			return { success: true as const, data: { images: result } };
		},
	);

	typedApp.delete(
		"/:eventId/images/:imageId",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: eventImageIdParamsSchema,
				response: {
					200: eventImageDeleteResponseSchema,
					400: eventErrorResponseSchema,
					401: eventErrorResponseSchema,
					403: eventErrorResponseSchema,
					404: eventErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}

			if (!app.storage.enabled) {
				throw new ValidationError(
					"Event image upload is not available at this time",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await deleteEventImage(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				session.userId,
				request.params.eventId,
				request.params.imageId,
				request.ip,
			);

			return { success: true as const, data: result };
		},
	);
};

export default eventRoutes;
