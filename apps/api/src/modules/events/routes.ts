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
	updateEventBodySchema,
	updateEventResponseSchema,
} from "./schemas.js";
import {
	createDraftEvent,
	getEvent,
	getEventPolicies,
	listEventCategories,
	listEventPricing,
	replaceEventCategories,
	replaceEventPricing,
	updateDraftEvent,
	updateEventPolicies,
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
				{ db: app.db, log: request.log },
				session.userId,
				request.params.eventId,
				request.body,
			);

			return { success: true as const, data: policies };
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
