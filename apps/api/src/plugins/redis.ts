import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { closeRedisClients, createRedisClients } from "../lib/redis.js";

const redisPlugin: FastifyPluginAsync = async (fastify) => {
	const clients = createRedisClients(fastify.config.REDIS_URL);

	await clients.base.ping();
	fastify.log.info("Redis connection established");

	fastify.decorate("redis", clients);

	fastify.addHook("onClose", async () => {
		fastify.log.info("Closing Redis connections");
		await closeRedisClients(clients);
	});
};

export default fp(redisPlugin, {
	name: "redis",
	dependencies: ["config"],
	fastify: "5.x",
});
