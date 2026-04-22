import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { UnauthorizedError } from "../lib/errors.js";

const internalKeyPlugin: FastifyPluginAsync = async (fastify) => {
	fastify.decorateRequest("isInternalRequest", false);

	fastify.addHook("onRequest", async (request) => {
		const headerValue = request.headers["x-internal-key"];

		if (headerValue === undefined) {
			return;
		}

		if (typeof headerValue !== "string") {
			throw new UnauthorizedError("Invalid internal API key");
		}

		const configuredKey = fastify.config.INTERNAL_API_KEY;
		if (!configuredKey) {
			throw new UnauthorizedError("Internal API key not configured");
		}

		const headerBuf = Buffer.from(headerValue);
		const configBuf = Buffer.from(configuredKey);

		if (
			headerBuf.length !== configBuf.length ||
			!timingSafeEqual(headerBuf, configBuf)
		) {
			throw new UnauthorizedError("Invalid internal API key");
		}

		request.isInternalRequest = true;
	});
};

export default fp(internalKeyPlugin, {
	name: "internal-key",
	dependencies: ["config"],
	fastify: "5.x",
});
