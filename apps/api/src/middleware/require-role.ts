import type { UserRole } from "@repo/shared/constants";
import { hasMinimumRole } from "@repo/shared/constants";
import type { FastifyReply, FastifyRequest } from "fastify";
import { InsufficientRoleError, UnauthorizedError } from "../lib/errors.js";

/**
 * Factory that returns a Fastify preHandler enforcing a minimum role level.
 * Uses hierarchical comparison: admin > organizer > participant > public.
 *
 * Implicitly checks authentication first — returns 401 before 403.
 *
 * @example
 * app.get("/admin/dashboard", { onRequest: [requireRole("admin")] }, handler);
 * app.post("/events", { onRequest: [requireRole("organizer")] }, handler);
 */
export function requireRole(minimumRole: UserRole) {
	return async function checkRole(
		request: FastifyRequest,
		_reply: FastifyReply,
	): Promise<void> {
		if (!request.session) {
			throw new UnauthorizedError();
		}

		if (!hasMinimumRole(request.session.role, minimumRole)) {
			throw new InsufficientRoleError(minimumRole);
		}
	};
}
