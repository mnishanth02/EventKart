import fastifyCors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const corsPlugin: FastifyPluginAsync = async (fastify) => {
	await fastify.register(fastifyCors, {
		origin: fastify.config.WEB_ORIGIN,
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
