import type { AppConfig } from "../lib/config.js";
import type { AppQueues } from "../lib/queue.js";
import type { RedisClients } from "../lib/redis.js";
import type { StorageClient } from "../lib/storage.js";
import type { Database } from "@repo/db";

export interface SessionInfo {
	userId: string;
	role: string;
	sessionId: string;
}

declare module "fastify" {
	interface FastifyInstance {
		config: AppConfig;
		db: Database;
		redis: RedisClients;
		queues: AppQueues;
		storage: StorageClient;
	}

	interface FastifyRequest {
		session: SessionInfo | null;
	}
}
