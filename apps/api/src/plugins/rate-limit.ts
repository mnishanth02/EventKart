import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
	await fastify.register(rateLimit, {
		global: true,
		max: 100,
		timeWindow: "1 minute",
		redis: fastify.redis.rateLimit,
		keyGenerator: (request) => {
			return request.ip;
		},
		errorResponseBuilder: (_request, context) => ({
			success: false,
			error: {
				code: "RATE_LIMITED",
				message: "Too many requests, please try again later",
				details: {
					retryAfterSeconds: Math.ceil(context.ttl / 1000),
				},
			},
		}),
	});
};

export default fp(rateLimitPlugin, {
	name: "rate-limit",
	fastify: "5.x",
	dependencies: ["redis"],
});
