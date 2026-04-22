import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { closeQueues, createQueues } from "../lib/queue.js";
import { createBullMQConnection } from "../lib/redis.js";

const queuePlugin: FastifyPluginAsync = async (fastify) => {
	const connection = createBullMQConnection(fastify.config.REDIS_URL);
	const queues = createQueues(connection);

	fastify.decorate("queues", queues);
	fastify.log.info("BullMQ queues initialized");

	fastify.addHook("onClose", async () => {
		fastify.log.info("Closing BullMQ queues");
		await closeQueues(queues);
		await connection.quit();
	});
};

export default fp(queuePlugin, {
	name: "queue",
	dependencies: ["config", "redis"],
	fastify: "5.x",
});
