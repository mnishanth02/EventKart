import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import type { AppConfig } from "../lib/config.js";

export interface ConfigPluginOptions {
	config: AppConfig;
}

const configPlugin: FastifyPluginAsync<ConfigPluginOptions> = async (
	fastify,
	options,
) => {
	fastify.decorate("config", options.config);
};

export default fp(configPlugin, {
	name: "config",
	fastify: "5.x",
});
