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
} from "./schemas.js";
import {
	createDraftEvent,
	listEventCategories,
	replaceEventCategories,
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
};

export default eventRoutes;
