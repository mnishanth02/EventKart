import type { Redis } from "ioredis";
import { Worker } from "bullmq";
import { QUEUE_NAMES, QUEUE_CONFIGS } from "../lib/queue.js";

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

export function createEmailWorker(
	connection: Redis,
	onFailed: DLQHandler,
): Worker {
	const config = QUEUE_CONFIGS[QUEUE_NAMES.email];
	const worker = new Worker(
		QUEUE_NAMES.email,
		async (_job) => {
			// TODO: Implement email sending (I-1.x)
			throw new Error("email worker not implemented");
		},
		{ connection, concurrency: config.concurrency },
	);

	worker.on("failed", (job, err) => void onFailed(job, err));
	return worker;
}
