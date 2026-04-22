import type { FastifyError, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "../lib/errors.js";

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
	fastify.setErrorHandler((error: FastifyError | AppError, request, reply) => {
		if (error instanceof AppError) {
			return reply.code(error.statusCode).send({
				success: false,
				error: {
					code: error.code,
					message: error.message,
					...(error.details ? { details: error.details } : {}),
				},
			});
		}

		// Fastify validation errors (from Zod type provider)
		if ("validation" in error && error.validation) {
			return reply.code(400).send({
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Request validation failed",
					details: {
						issues: error.validation,
					},
				},
			});
		}

		// Unexpected errors — log and return generic 500
		request.log.error(error, "Unhandled error");
		return reply.code(500).send({
			success: false,
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred",
			},
		});
	});
};

export default fp(errorHandlerPlugin, {
	name: "error-handler",
	fastify: "5.x",
});
