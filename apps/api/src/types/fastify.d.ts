import type { AppConfig } from "../lib/config.js";
import type { AppQueues } from "../lib/queue.js";
import type { RedisClients } from "../lib/redis.js";
import type { StorageClient } from "../lib/storage.js";

declare module "fastify" {
	interface FastifyInstance {
		config: AppConfig;
		redis: RedisClients;
		queues: AppQueues;
		storage: StorageClient;
	}
}
