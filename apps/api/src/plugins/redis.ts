import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import {
	closeRedisClients,
	createRedisClients,
	pingRedis,
} from "../lib/redis.js";

const redisPlugin: FastifyPluginAsync = async (fastify) => {
	try {
		await pingRedis(fastify.config.REDIS_URL);
	} catch (error) {
		throw new Error(
			"Redis connection failed. Ensure Redis is running and REDIS_URL is reachable before starting the API.",
			{ cause: error },
		);
	}

	const clients = createRedisClients(fastify.config.REDIS_URL);
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
