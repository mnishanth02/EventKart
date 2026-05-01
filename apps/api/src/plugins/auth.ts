import { SESSION_COOKIE_NAME, userRoleSchema } from "@repo/shared/constants";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import {
	buildSessionCookieOptions,
	getRedisSession,
	type SessionData,
} from "../lib/session.js";

const authPlugin: FastifyPluginAsync = async (fastify) => {
	fastify.decorateRequest("session", null);

	fastify.addHook("onRequest", async (request, reply) => {
		const sessionId = request.cookies[SESSION_COOKIE_NAME];

		if (!sessionId) {
			request.session = null;
			return;
		}

		let sessionData: SessionData | null;
		try {
			sessionData = await getRedisSession(fastify.redis.session, sessionId);
		} catch (error) {
			// Redis unavailable — do NOT clear the cookie (transient failure).
			request.log.error(
				{ err: error, sessionId },
				"Redis error during session lookup",
			);
			request.session = null;
			return;
		}

		if (!sessionData) {
			clearStaleCookie(reply, fastify.config.COOKIE_DOMAIN);
			request.session = null;
			return;
		}

		// Defense-in-depth: validate expiresAt even though Redis TTL handles expiry.
		const expiresAt = Date.parse(sessionData.expiresAt);
		if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
			request.log.warn(
				{ sessionId },
				"Session expired or has invalid expiresAt — cleaning up",
			);
			await safeDeleteSession(fastify.redis.session, sessionId, request);
			clearStaleCookie(reply, fastify.config.COOKIE_DOMAIN);
			request.session = null;
			return;
		}

		// Validate role from Redis is a known UserRole
		const roleResult = userRoleSchema.safeParse(sessionData.role);
		if (!roleResult.success) {
			request.log.warn(
				{ sessionId, role: sessionData.role },
				"Session has invalid role — treating as unauthenticated",
			);
			await safeDeleteSession(fastify.redis.session, sessionId, request);
			clearStaleCookie(reply, fastify.config.COOKIE_DOMAIN);
			request.session = null;
			return;
		}

		request.session = {
			userId: sessionData.userId,
			role: roleResult.data,
			sessionId,
		};
	});

	fastify.addHook("onSend", async (_request, reply, payload) => {
		if (isPublicCacheControl(reply.getHeader("cache-control"))) {
			reply.removeHeader("set-cookie");
		}

		return payload;
	});
};

function isPublicCacheControl(header: string | number | string[] | undefined) {
	const values = Array.isArray(header) ? header : [header];
	return values.some(
		(value) =>
			typeof value === "string" &&
			value
				.split(",")
				.some((directive) => directive.trim().toLowerCase() === "public"),
	);
}

function clearStaleCookie(
	reply: {
		clearCookie: (name: string, options: Record<string, unknown>) => void;
	},
	cookieDomain?: string,
) {
	const { maxAge: _, ...clearOptions } =
		buildSessionCookieOptions(cookieDomain);
	reply.clearCookie(SESSION_COOKIE_NAME, clearOptions);
}

async function safeDeleteSession(
	redis: { del: (key: string) => Promise<number> },
	sessionId: string,
	request: {
		log: { error: (obj: Record<string, unknown>, msg: string) => void };
	},
) {
	try {
		await redis.del(sessionId);
	} catch (error) {
		request.log.error(
			{ err: error, sessionId },
			"Failed to delete expired session from Redis",
		);
	}
}

export default fp(authPlugin, {
	name: "auth",
	dependencies: ["config", "redis"],
	fastify: "5.x",
});
