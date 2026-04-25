import { createDatabase } from "@repo/db";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const databasePlugin: FastifyPluginAsync = async (fastify) => {
	const db = createDatabase(fastify.config.DATABASE_URL);

	fastify.decorate("db", db);
	fastify.log.info("Database connection established");

	fastify.addHook("onClose", async () => {
		fastify.log.info("Closing database connection");
		// postgres.js handles connection cleanup via process exit;
		// explicit close is not exposed by drizzle's postgres-js driver.
	});
};

export default fp(databasePlugin, {
	name: "database",
	dependencies: ["config"],
	fastify: "5.x",
});
