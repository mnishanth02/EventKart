import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { UnauthorizedError } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import {
	createEventBodySchema,
	createEventResponseSchema,
	eventErrorResponseSchema,
} from "./schemas.js";
import { createDraftEvent } from "./service.js";

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
};

export default eventRoutes;
