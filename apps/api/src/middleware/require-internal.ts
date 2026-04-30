import type { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../lib/errors.js";

/**
 * Fastify preHandler that requires the request to have presented a valid
 * internal API key. Relies on the `internal-key` plugin to set
 * `request.isInternalRequest` after validating the `x-internal-key`
 * header against `config.INTERNAL_API_KEY`.
 *
 * Use on server-to-server endpoints that must NOT be reachable by
 * anonymous browser traffic (e.g., `GET /organizers/:id/next-event`,
 * which would otherwise leak organizer-UUID existence).
 */
export async function requireInternal(
	request: FastifyRequest,
	_reply: FastifyReply,
): Promise<void> {
	if (!request.isInternalRequest) {
		throw new UnauthorizedError("Internal API key required");
	}
}
