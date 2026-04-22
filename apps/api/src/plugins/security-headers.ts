import fastifyHelmet from "@fastify/helmet";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const securityHeadersPlugin: FastifyPluginAsync = async (fastify) => {
	await fastify.register(fastifyHelmet, {
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'none'"],
				frameAncestors: ["'none'"],
			},
		},
		xFrameOptions: { action: "deny" },
	});
};

export default fp(securityHeadersPlugin, {
	name: "security-headers",
	fastify: "5.x",
	dependencies: ["config"],
});
