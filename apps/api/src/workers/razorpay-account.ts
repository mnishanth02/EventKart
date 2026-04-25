import type { Database } from "@repo/db";
import { Worker } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import { QUEUE_CONFIGS, QUEUE_NAMES } from "../lib/queue.js";
import type { RazorpayClient } from "../lib/razorpay.js";
import { createLinkedAccount } from "../modules/payment/razorpay-account-service.js";

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

export interface RazorpayAccountWorkerDeps {
	db: Database;
	razorpayClient: RazorpayClient;
}

export function createRazorpayAccountWorker(
	connection: Redis,
	onFailed: DLQHandler,
	deps: RazorpayAccountWorkerDeps,
): Worker {
	const config = QUEUE_CONFIGS[QUEUE_NAMES.razorpayAccount];

	const worker = new Worker(
		QUEUE_NAMES.razorpayAccount,
		async (job) => {
			const { organizerId } = job.data as { organizerId: string };
			const log = {
				info: console.info.bind(console),
				warn: console.warn.bind(console),
				error: console.error.bind(console),
				debug: console.debug.bind(console),
				fatal: console.error.bind(console),
				trace: console.debug.bind(console),
				child: () => log,
				silent: () => {},
			} as unknown as FastifyBaseLogger;

			await createLinkedAccount(deps.db, log, deps.razorpayClient, organizerId);
		},
		{ connection, concurrency: config.concurrency },
	);

	worker.on("failed", (job, err) => void onFailed(job, err));
	return worker;
}
