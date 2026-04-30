import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	CDN_PURGE_JOB_NAME,
	CDN_PURGE_QUEUE_NAME,
	type CdnPurgePayload,
	enqueueCdnPurge,
} from "../../src/queues/cdn-purge.js";

describe("CDN purge queue constants (I-2.4.2)", () => {
	it("queue name matches the registry constant", () => {
		expect(CDN_PURGE_QUEUE_NAME).toBe("cdn-purge");
	});

	it("uses a single 'purge' job name", () => {
		expect(CDN_PURGE_JOB_NAME).toBe("purge");
	});
});

describe("enqueueCdnPurge — fail-soft branches", () => {
	let logEntries: Array<{ level: string; obj: unknown; msg?: string }>;
	let logger: {
		debug: (obj: unknown, msg?: string) => void;
		warn: (obj: unknown, msg?: string) => void;
	};

	beforeEach(() => {
		logEntries = [];
		logger = {
			debug: (obj, msg) => {
				logEntries.push({ level: "debug", obj, msg });
			},
			warn: (obj, msg) => {
				logEntries.push({ level: "warn", obj, msg });
			},
		};
	});

	it("returns null when queue is undefined; logs at debug only", async () => {
		const result = await enqueueCdnPurge(
			undefined,
			{ urls: ["https://x.test/a"], reason: "test" },
			logger,
		);

		expect(result).toBeNull();
		const debugs = logEntries.filter((e) => e.level === "debug");
		expect(debugs).toHaveLength(1);
		expect(debugs[0]!.obj).toMatchObject({
			event: "cdn_purge_enqueue_skipped",
			reason: "queue_undefined",
		});
		// Critically: no warn — the absent queue is an expected condition,
		// not an error. Spamming warn here would make logs unreadable in
		// the (common) test environment.
		expect(logEntries.some((e) => e.level === "warn")).toBe(false);
	});

	it("returns null when payload has neither urls nor tags", async () => {
		const queue = {
			add: vi.fn().mockResolvedValue({ id: "j1" }),
		};

		const result = await enqueueCdnPurge(
			// biome-ignore lint/suspicious/noExplicitAny: minimal Queue stub
			queue as any,
			{ reason: "empty-test" },
			logger,
		);

		expect(result).toBeNull();
		expect(queue.add).not.toHaveBeenCalled();
		expect(logEntries[0]!.obj).toMatchObject({
			event: "cdn_purge_enqueue_skipped",
			reason: "empty_payload",
		});
	});

	it("returns null when both urls and tags are present-but-empty arrays", async () => {
		const queue = { add: vi.fn().mockResolvedValue({ id: "j1" }) };
		const result = await enqueueCdnPurge(
			// biome-ignore lint/suspicious/noExplicitAny: minimal Queue stub
			queue as any,
			{ urls: [], tags: [], reason: "empty-arrays" },
			logger,
		);
		expect(result).toBeNull();
		expect(queue.add).not.toHaveBeenCalled();
	});

	it("forwards payload to queue.add with the canonical job name", async () => {
		const queue = {
			add: vi.fn().mockResolvedValue({ id: "job-42" }),
		};
		const payload: CdnPurgePayload = {
			urls: ["https://x.test/a"],
			reason: "event_publish",
			correlationId: "req-1",
		};

		const result = await enqueueCdnPurge(
			// biome-ignore lint/suspicious/noExplicitAny: minimal Queue stub
			queue as any,
			payload,
			logger,
		);

		expect(result).toBe("job-42");
		expect(queue.add).toHaveBeenCalledTimes(1);
		const firstCall = queue.add.mock.calls[0]!;
		expect(firstCall[0]).toBe(CDN_PURGE_JOB_NAME);
		expect(firstCall[1]).toEqual(payload);
	});

	it("swallows queue.add() failures and warn-logs", async () => {
		const queue = {
			add: vi.fn().mockRejectedValue(new Error("redis unreachable")),
		};

		const result = await enqueueCdnPurge(
			// biome-ignore lint/suspicious/noExplicitAny: minimal Queue stub
			queue as any,
			{ urls: ["https://x.test/a"], reason: "event_publish" },
			logger,
		);

		expect(result).toBeNull();
		const warns = logEntries.filter((e) => e.level === "warn");
		expect(warns).toHaveLength(1);
		expect(warns[0]!.obj).toMatchObject({
			event: "cdn_purge_enqueue_failed",
		});
	});

	it("returns null (not undefined) when add returns a job without an id", async () => {
		const queue = { add: vi.fn().mockResolvedValue({ /* no id */ }) };
		const result = await enqueueCdnPurge(
			// biome-ignore lint/suspicious/noExplicitAny: minimal Queue stub
			queue as any,
			{ urls: ["https://x.test/a"], reason: "test" },
			logger,
		);
		expect(result).toBeNull();
	});

	it("works without a logger argument", async () => {
		const queue = { add: vi.fn().mockResolvedValue({ id: "j1" }) };

		// Should not throw despite the absent logger.
		const result = await enqueueCdnPurge(
			// biome-ignore lint/suspicious/noExplicitAny: minimal Queue stub
			queue as any,
			{ urls: ["https://x.test/a"], reason: "no-logger" },
		);
		expect(result).toBe("j1");
	});
});
