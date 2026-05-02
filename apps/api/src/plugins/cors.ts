import fastifyCors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const corsPlugin: FastifyPluginAsync = async (fastify) => {
	const allowedOrigins = new Set(fastify.config.WEB_ORIGINS);

	await fastify.register(fastifyCors, {
		origin: (origin, callback) => {
			if (!origin) {
				callback(null, false);
				return;
			}

			callback(null, allowedOrigins.has(origin));
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-Request-ID",
			"X-CSRF-Token",
		],
	});
};

export default fp(corsPlugin, {
	name: "cors",
	fastify: "5.x",
	dependencies: ["config"],
});
