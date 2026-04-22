import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import {
	createDisabledStorageClient,
	createStorageClient,
} from "../lib/storage.js";

const storagePlugin: FastifyPluginAsync = async (fastify) => {
	const {
		S3_ENDPOINT,
		S3_REGION,
		S3_ACCESS_KEY_ID,
		S3_SECRET_ACCESS_KEY,
		S3_BUCKET,
		S3_FORCE_PATH_STYLE,
	} = fastify.config;

	if (
		!S3_ENDPOINT ||
		!S3_ACCESS_KEY_ID ||
		!S3_SECRET_ACCESS_KEY ||
		!S3_BUCKET
	) {
		fastify.decorate("storage", createDisabledStorageClient());
		fastify.log.warn(
			"Object storage not configured — S3 env vars missing",
		);
		return;
	}

	const client = createStorageClient({
		endpoint: S3_ENDPOINT,
		region: S3_REGION ?? "auto",
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
		bucket: S3_BUCKET,
		forcePathStyle: S3_FORCE_PATH_STYLE ?? true,
	});

	fastify.decorate("storage", client);
	fastify.log.info("Object storage client initialized");

	fastify.addHook("onClose", async () => {
		fastify.log.info("Closing object storage client");
		client.destroy();
	});
};

export default fp(storagePlugin, {
	name: "storage",
	dependencies: ["config"],
	fastify: "5.x",
});
