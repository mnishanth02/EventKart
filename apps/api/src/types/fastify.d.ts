import type { AppConfig } from "../lib/config.js";

declare module "fastify" {
	interface FastifyInstance {
		config: AppConfig;
	}
}
