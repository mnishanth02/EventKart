import type { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../lib/errors.js";

/**
 * Fastify preHandler that requires an authenticated session.
 * Throws 401 UnauthorizedError if request.session is null.
 */
export async function requireAuth(
	request: FastifyRequest,
	_reply: FastifyReply,
): Promise<void> {
	if (!request.session) {
		throw new UnauthorizedError();
	}
}
