import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { pingDatabase } from "@repo/db";
import { z } from "zod";

const CHECK_TIMEOUT_MS = 3000;

const healthResponseSchema = z.object({
	status: z.literal("ok"),
});

const checkSchema = z.object({
	name: z.string(),
	status: z.enum(["ok", "error"]),
	latency_ms: z.number().nonnegative(),
	message: z.string().optional(),
});

const readyOkSchema = z.object({
	status: z.literal("ok"),
	uptime: z.number().nonnegative(),
	checks: z.array(checkSchema),
});

const readyDegradedSchema = z.object({
	status: z.literal("degraded"),
	uptime: z.number().nonnegative(),
	checks: z.array(checkSchema),
});

function sanitizeErrorMessage(error: unknown): string {
	if (
		error instanceof DOMException &&
		error.name === "TimeoutError"
	) {
		return "Timeout";
	}
	if (
		error instanceof Error &&
		error.message === "Timeout"
	) {
		return "Timeout";
	}
	return "Connection failed";
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error("Timeout"));
			}, timeoutMs);
			// Avoid holding the process open
			if (typeof timer === "object" && "unref" in timer) {
				timer.unref();
			}
		}),
	]);
}

interface CheckResult {
	name: string;
	status: "ok" | "error";
	latency_ms: number;
	message?: string;
}

async function runCheck(
	name: string,
	fn: () => Promise<unknown>,
): Promise<CheckResult> {
	const start = performance.now();
	try {
		await withTimeout(fn(), CHECK_TIMEOUT_MS);
		return {
			name,
			status: "ok",
			latency_ms: Math.round(performance.now() - start),
		};
	} catch (error: unknown) {
		return {
			name,
			status: "error",
			latency_ms: Math.round(performance.now() - start),
			message: sanitizeErrorMessage(error),
		};
	}
}

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
					200: readyOkSchema,
					503: readyDegradedSchema,
				},
			},
		},
		async (_request, reply) => {
			const checks = await Promise.all([
				runCheck("postgres", () => pingDatabase(fastify.db)),
				runCheck("redis", () => fastify.redis.base.ping()),
			]);

			const allHealthy = checks.every((c) => c.status === "ok");
			const status = allHealthy ? ("ok" as const) : ("degraded" as const);
			const statusCode = allHealthy ? 200 : 503;

			return reply.status(statusCode).send({
				status,
				uptime: process.uptime(),
				checks,
			});
		},
	);
};

export default healthRoutes;
