import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import cookie from "@fastify/cookie";
import Fastify, { type FastifyServerOptions } from "fastify";

import { type AppConfig, loadConfig } from "./lib/config.js";
import { createLoggerOptions } from "./lib/logger.js";
import configPlugin from "./plugins/config.js";
import corsPlugin from "./plugins/cors.js";
import databasePlugin from "./plugins/database.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import securityHeadersPlugin from "./plugins/security-headers.js";
import queuePlugin from "./plugins/queue.js";
import redisPlugin from "./plugins/redis.js";
import storagePlugin from "./plugins/storage.js";
import internalKeyPlugin from "./plugins/internal-key.js";
import authPlugin from "./plugins/auth.js";
import csrfPlugin from "./plugins/csrf.js";
import metricsPlugin from "./plugins/metrics.js";
import authRoutes from "./modules/auth/routes.js";
import organizerRoutes from "./modules/organizer/routes.js";
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
		logger: options.logger ?? createLoggerOptions(config),
		requestIdHeader: "x-request-id",
		trustProxy: true,
	}).withTypeProvider<ZodTypeProvider>();

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	app.addHook("onRequest", async (request, reply) => {
		reply.header("x-request-id", request.id);
	});

	app.register(configPlugin, { config });
	app.register(databasePlugin);
	app.register(securityHeadersPlugin);
	app.register(redisPlugin);
	app.register(queuePlugin);
	app.register(metricsPlugin);
	app.register(corsPlugin);
	app.register(cookie);
	app.register(storagePlugin);
	app.register(internalKeyPlugin);
	app.register(authPlugin);
	app.register(csrfPlugin);
	app.register(errorHandlerPlugin);
	app.register(rateLimitPlugin);
	app.register(healthRoutes);
	app.register(authRoutes, { prefix: "/api/v1/auth" });
	app.register(organizerRoutes, { prefix: "/api/v1/organizers" });

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
