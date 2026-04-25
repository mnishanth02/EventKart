import { Worker } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import { sendEmail } from "../lib/email.js";
import { QUEUE_CONFIGS, QUEUE_NAMES } from "../lib/queue.js";

type DLQHandler = (
	job:
		| {
				id?: string;
				name: string;
				queueName: string;
				data: unknown;
				attemptsMade: number;
				opts: { attempts?: number };
		  }
		| undefined,
	error: Error,
) => Promise<void>;

export interface EmailWorkerOptions {
	resendApiKey?: string;
	emailFrom?: string;
}

export function createEmailWorker(
	connection: Redis,
	onFailed: DLQHandler,
	options?: EmailWorkerOptions,
): Worker {
	const config = QUEUE_CONFIGS[QUEUE_NAMES.email];
	const emailFrom = options?.emailFrom ?? "EventKart <noreply@eventkart.app>";
	const resendApiKey = options?.resendApiKey;

	const worker = new Worker(
		QUEUE_NAMES.email,
		async (job) => {
			const { to, subject, html } = job.data as {
				to: string;
				subject: string;
				html: string;
			};

			await sendEmail(
				{
					resendApiKey,
					emailFrom,
					log: {
						info: console.info,
						warn: console.warn,
						error: console.error,
					} as unknown as FastifyBaseLogger,
				},
				{ to, subject, html },
			);
		},
		{ connection, concurrency: config.concurrency },
	);

	worker.on("failed", (job, err) => void onFailed(job, err));
	return worker;
}
