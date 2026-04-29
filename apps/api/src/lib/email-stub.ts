import {
	buildEmailIdempotencyKey,
	type EmailJobName,
} from "@repo/shared/constants";
import type { FastifyBaseLogger } from "fastify";

export interface EmailStubInput {
	jobName: EmailJobName;
	recipientEmail: string;
	resourceId: string;
	suffix?: string;
	context?: Record<string, unknown>;
}

/**
 * Wave B: log-only email job stub. Replace with the real queue producer when
 * the email worker ships. Callers MUST wrap calls in try/catch so an email
 * failure never breaks the parent operation.
 */
export function logEmailStub(
	log: Pick<FastifyBaseLogger, "info">,
	input: EmailStubInput,
): void {
	const idempotencyKey = buildEmailIdempotencyKey(
		input.jobName,
		input.resourceId,
		input.suffix,
	);
	log.info(
		{
			emailStub: true,
			jobName: input.jobName,
			idempotencyKey,
			// NOTE: recipientEmail intentionally omitted to avoid PII in logs.
			// The idempotencyKey encodes resourceId for traceability.
		},
		`email-stub:${input.jobName}`,
	);
}
