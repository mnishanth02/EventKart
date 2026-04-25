import { Worker } from "bullmq";
import type { Redis } from "ioredis";
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

export function createPaymentWebhookWorker(
	connection: Redis,
	onFailed: DLQHandler,
): Worker {
	const config = QUEUE_CONFIGS[QUEUE_NAMES.paymentWebhook];
	const worker = new Worker(
		QUEUE_NAMES.paymentWebhook,
		async (_job) => {
			// TODO: Implement payment webhook processing (I-3.x)
			// 1. Row-lock booking
			// 2. State machine transition
			// 3. Enqueue downstream jobs (email confirmation, etc.)
			throw new Error("payment-webhook worker not implemented");
		},
		{
			connection,
			concurrency: config.concurrency,
		},
	);

	worker.on("failed", (job, err) => void onFailed(job, err));
	return worker;
}
