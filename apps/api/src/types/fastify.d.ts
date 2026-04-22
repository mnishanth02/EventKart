import type { AppConfig } from "../lib/config.js";
import type { RedisClients } from "../lib/redis.js";

declare module "fastify" {
	interface FastifyInstance {
		config: AppConfig;
		redis: RedisClients;
	}
}
