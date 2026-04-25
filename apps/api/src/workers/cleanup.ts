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

export function createCleanupWorker(
	connection: Redis,
	onFailed: DLQHandler,
): Worker {
	const config = QUEUE_CONFIGS[QUEUE_NAMES.cleanup];
	const worker = new Worker(
		QUEUE_NAMES.cleanup,
		async (_job) => {
			// TODO: Implement sensitive data cleanup (I-5.x)
			throw new Error("cleanup worker not implemented");
		},
		{ connection, concurrency: config.concurrency },
	);

	worker.on("failed", (job, err) => void onFailed(job, err));
	return worker;
}
