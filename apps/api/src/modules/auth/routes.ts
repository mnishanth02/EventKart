import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { sendOtpForPhone, verifyOtpAndCreateSession } from "./service.js";
import {
	otpSendBodySchema,
	otpSendResponseSchema,
	otpVerifyBodySchema,
	otpVerifyResponseSchema,
	otpErrorResponseSchema,
} from "./schemas.js";
import { SESSION_COOKIE_NAME } from "@repo/shared/constants";
import { buildSessionCookieOptions } from "../../lib/session.js";

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
			},
		},
		async (request, reply) => {
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

			const cookieOptions = buildSessionCookieOptions(
				fastify.config.COOKIE_DOMAIN,
			);

			reply.setCookie(SESSION_COOKIE_NAME, result.sessionId, cookieOptions);

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
};

export default authRoutes;
