import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import {
	sendOtpForPhone,
	verifyOtpAndCreateSession,
	logoutSession,
} from "./service.js";
import {
	otpSendBodySchema,
	otpSendResponseSchema,
	otpVerifyBodySchema,
	otpVerifyResponseSchema,
	otpErrorResponseSchema,
	logoutResponseSchema,
	logoutErrorResponseSchema,
} from "./schemas.js";
import {
	SESSION_COOKIE_NAME,
	CSRF_COOKIE_NAME,
} from "@repo/shared/constants";
import { buildSessionCookieOptions } from "../../lib/session.js";
import {
	generateCsrfToken,
	buildCsrfCookieOptions,
	buildCsrfClearOptions,
} from "../../plugins/csrf.js";
import { UnauthorizedError, ForbiddenError } from "../../lib/errors.js";

/**
 * Validate Origin header against WEB_ORIGIN for login-CSRF protection.
 * Prevents cross-origin session establishment attacks.
 */
function validateOrigin(
	requestOrigin: string | undefined,
	allowedOrigin: string,
): boolean {
	if (!requestOrigin) {
		return false;
	}
	return requestOrigin === allowedOrigin;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
	const app = fastify.withTypeProvider<ZodTypeProvider>();

	app.post(
		"/otp/send",
		{
			schema: {
				body: otpSendBodySchema,
				response: {
					200: otpSendResponseSchema,
					400: otpErrorResponseSchema,
					429: otpErrorResponseSchema,
					502: otpErrorResponseSchema,
				},
			},
			config: {
				rateLimit: {
					max: 10,
					timeWindow: "1 minute",
				},
				csrfProtection: false,
			},
		},
		async (request, reply) => {
			const { phone } = request.body;

			const result = await sendOtpForPhone(
				{
					redis: fastify.redis.otp,
					config: fastify.config,
					log: request.log,
				},
				phone,
			);

			return reply.code(200).send({
				success: true as const,
				data: result,
			});
		},
	);

	app.post(
		"/otp/verify",
		{
			schema: {
				body: otpVerifyBodySchema,
				response: {
					200: otpVerifyResponseSchema,
					400: otpErrorResponseSchema,
					429: otpErrorResponseSchema,
				},
			},
			config: {
				rateLimit: {
					max: 10,
					timeWindow: "1 minute",
				},
				csrfProtection: false,
			},
		},
		async (request, reply) => {
			// Login-CSRF protection: validate Origin header
			const origin = request.headers.origin;
			if (!validateOrigin(origin, fastify.config.WEB_ORIGIN)) {
				request.log.warn(
					{ origin, expected: fastify.config.WEB_ORIGIN },
					"OTP verify rejected: invalid Origin header",
				);
				throw new ForbiddenError(
					"Invalid request origin",
					"INVALID_ORIGIN",
				);
			}

			const { phone, otp } = request.body;

			const result = await verifyOtpAndCreateSession(
				{
					otpRedis: fastify.redis.otp,
					sessionRedis: fastify.redis.session,
					db: fastify.db,
					config: fastify.config,
					log: request.log,
					ip: request.ip,
					userAgent: request.headers["user-agent"],
				},
				phone,
				otp,
			);

			// Set session cookie
			const cookieOptions = buildSessionCookieOptions(
				fastify.config.COOKIE_DOMAIN,
			);
			reply.setCookie(SESSION_COOKIE_NAME, result.sessionId, cookieOptions);

			// Set CSRF cookie (bound to new session)
			const csrfToken = generateCsrfToken(
				result.sessionId,
				fastify.config.CSRF_SECRET,
			);
			reply.setCookie(
				CSRF_COOKIE_NAME,
				csrfToken,
				buildCsrfCookieOptions(fastify.config.COOKIE_DOMAIN),
			);

			return reply.code(200).send({
				success: true as const,
				data: {
					userId: result.userId,
					role: result.role,
					isNewUser: result.isNewUser,
				},
			});
		},
	);

	app.post(
		"/logout",
		{
			schema: {
				response: {
					200: logoutResponseSchema,
					401: logoutErrorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			if (!request.session) {
				throw new UnauthorizedError();
			}

			await logoutSession(
				{
					sessionRedis: fastify.redis.session,
					db: fastify.db,
					log: request.log,
				},
				request.session.sessionId,
			);

			// Clear session cookie
			const { maxAge: _, ...clearOptions } = buildSessionCookieOptions(
				fastify.config.COOKIE_DOMAIN,
			);
			reply.clearCookie(SESSION_COOKIE_NAME, clearOptions);

			// Clear CSRF cookie
			reply.clearCookie(
				CSRF_COOKIE_NAME,
				buildCsrfClearOptions(fastify.config.COOKIE_DOMAIN),
			);

			return reply.code(200).send({
				success: true as const,
				data: {
					message: "Logged out successfully",
				},
			});
		},
	);
};

export default authRoutes;
