import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { NotFoundError } from "../../lib/errors.js";
import {
	registerOrganizerBodySchema,
	registerOrganizerResponseSchema,
	getOrganizerResponseSchema,
	organizerNotFoundResponseSchema,
	organizerConflictResponseSchema,
	organizerErrorResponseSchema,
} from "./schemas.js";
import { registerOrganizer, getOrganizerByUserId } from "./service.js";

const organizerRoutes: FastifyPluginAsync = async (app) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	/**
	 * POST /api/v1/organizers — Register a new organizer profile.
	 *
	 * Requires authenticated user with at least 'organizer' role
	 * (granted after email verification in Phase 0).
	 */
	typedApp.post(
		"/",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				body: registerOrganizerBodySchema,
				response: {
					201: registerOrganizerResponseSchema,
					400: organizerErrorResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					409: organizerConflictResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const profile = await registerOrganizer(
				{ db: app.db, log: request.log },
				request.session!.userId,
				request.body,
			);

			reply.code(201);
			return { success: true as const, data: profile };
		},
	);

	/**
	 * GET /api/v1/organizers/me — Get the authenticated user's organizer profile.
	 *
	 * Requires authenticated user with at least 'organizer' role.
	 */
	typedApp.get(
		"/me",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				response: {
					200: getOrganizerResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerNotFoundResponseSchema,
				},
			},
		},
		async (request) => {
			const profile = await getOrganizerByUserId(
				app.db,
				request.session!.userId,
			);

			if (!profile) {
				throw new NotFoundError("Organizer profile not found");
			}

			return { success: true as const, data: profile };
		},
	);
};

export default organizerRoutes;
