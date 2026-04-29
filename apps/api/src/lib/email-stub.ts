import type { EmailJobName } from "@repo/shared/constants";
import type { FastifyBaseLogger } from "fastify";

export interface EmailStubParams {
	jobName: EmailJobName;
	context?: Record<string, unknown>;
	idempotencyKey: string;
}

/**
 * Wave B: log-only email job stub. Replace with the real queue producer when
 * the email worker ships. Stub logging is defensive and never throws.
 */
export function emitEmailStub(
	fastify: { log: Pick<FastifyBaseLogger, "info"> },
	params: EmailStubParams,
): void {
	try {
		fastify.log.info(
			{
				jobName: params.jobName,
				idempotencyKey: params.idempotencyKey,
				...params.context,
			},
			"email enqueue point (Phase 3)",
		);
	} catch {
		// Stub logging must never break a successful product flow.
	}
}
