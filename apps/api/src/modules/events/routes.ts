import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { UnauthorizedError } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import {
	createEventBodySchema,
	createEventResponseSchema,
	eventCategoriesBodySchema,
	eventCategoriesResponseSchema,
	eventErrorResponseSchema,
	eventIdParamsSchema,
	eventPoliciesBodySchema,
	eventPoliciesResponseSchema,
	eventPricingBodySchema,
	eventPricingResponseSchema,
} from "./schemas.js";
import {
	createDraftEvent,
	getEventPolicies,
	listEventCategories,
	listEventPricing,
	replaceEventCategories,
	replaceEventPricing,
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
};

export default eventRoutes;
