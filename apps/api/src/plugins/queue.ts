import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { closeQueues, createQueues } from "../lib/queue.js";
import { createBullMQConnection } from "../lib/redis.js";
import { scheduleSitemapRegenCron } from "../queues/sitemap-regen.js";

const queuePlugin: FastifyPluginAsync = async (fastify) => {
	const connection = createBullMQConnection(fastify.config.REDIS_URL);
	const queues = createQueues(connection);

	fastify.decorate("queues", queues);
	fastify.log.info("BullMQ queues initialized");

	// I-2.4.4: register the nightly sitemap regen tick. BullMQ
	// repeatable upserts are idempotent so calling this on every boot
	// is safe. Failure must NOT crash startup — without the cron the
	// publish-driven debounced enqueues still keep the cache fresh.
	try {
		await scheduleSitemapRegenCron(queues.sitemapRegen);
		fastify.log.info("sitemap-regen cron scheduled");
	} catch (err) {
		fastify.log.warn(
			{ err },
			"failed to schedule sitemap-regen cron; continuing without it",
		);
	}

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
