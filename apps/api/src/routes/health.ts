import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const healthResponseSchema = z.object({
	status: z.literal("ok"),
});

const readyResponseSchema = z.object({
	status: z.literal("ok"),
	uptime: z.number().nonnegative(),
});

const healthRoutes: FastifyPluginAsync = async (fastify) => {
	const app = fastify.withTypeProvider<ZodTypeProvider>();

	app.get(
		"/health",
		{
			schema: {
				response: {
					200: healthResponseSchema,
				},
			},
		},
		async () => ({ status: "ok" as const }),
	);

	app.get(
		"/ready",
		{
			schema: {
				response: {
					200: readyResponseSchema,
				},
			},
		},
		async () => ({
			status: "ok" as const,
			uptime: process.uptime(),
		}),
	);
};

export default healthRoutes;
