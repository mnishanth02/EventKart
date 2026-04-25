import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createRazorpayClient, type RazorpayClient } from "../lib/razorpay.js";

declare module "fastify" {
	interface FastifyInstance {
		razorpay: RazorpayClient;
	}
}

const razorpayPlugin: FastifyPluginAsync = async (fastify) => {
	const client = createRazorpayClient(fastify.config, fastify.log);
	fastify.decorate("razorpay", client);
};

export default fp(razorpayPlugin, {
	name: "razorpay",
	dependencies: ["config"],
	fastify: "5.x",
});
