import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import Fastify, { type FastifyServerOptions } from "fastify";

import { type AppConfig, loadConfig } from "./lib/config.js";
import configPlugin from "./plugins/config.js";
import corsPlugin from "./plugins/cors.js";
import redisPlugin from "./plugins/redis.js";
import healthRoutes from "./routes/health.js";

export interface BuildAppOptions {
	config?: Partial<AppConfig>;
	logger?: FastifyServerOptions["logger"];
}

export function buildApp(options: BuildAppOptions = {}) {
	const config = loadConfig({
		...process.env,
		...options.config,
	});

	const app = Fastify({
		logger: options.logger ?? { level: config.LOG_LEVEL ?? "info" },
		requestIdHeader: "x-request-id",
		trustProxy: true,
	}).withTypeProvider<ZodTypeProvider>();

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	app.addHook("onRequest", async (request, reply) => {
		reply.header("x-request-id", request.id);
	});

	app.register(configPlugin, { config });
	app.register(redisPlugin);
	app.register(corsPlugin);
	app.register(healthRoutes);

	app.setNotFoundHandler((request, reply) => {
		reply.code(404);
		return {
			error: "Not Found",
			message: `Route ${request.method} ${request.url} not found`,
			statusCode: 404,
		};
	});

	return app;
}
