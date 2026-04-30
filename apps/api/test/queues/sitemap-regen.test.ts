import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import {
	enqueueSitemapRegen,
	scheduleSitemapRegenCron,
	SITEMAP_REGEN_CRON_PATTERN,
	SITEMAP_REGEN_DEBOUNCE_JOB_ID,
	SITEMAP_REGEN_JOB_NAME,
} from "../../src/queues/sitemap-regen.js";

/**
 * I-2.4.4 — `enqueueSitemapRegen` + `scheduleSitemapRegenCron` unit tests.
 *
 * The worker behaviour itself is integration territory; here we pin
 * the call contracts that callers (events service, admin verification,
 * plugins/queue) depend on:
 *   * Undefined queue is a safe no-op.
 *   * Ad-hoc enqueues share the debounce jobId.
 *   * Reason is propagated as job data.
 *   * Cron uses the right pattern and a UTC timezone, NOT the
 *     debounce jobId.
 */

function createMockQueue() {
	const add = vi.fn().mockResolvedValue({ id: "mock-job" });
	return { add } as unknown as Queue & { add: ReturnType<typeof vi.fn> };
}

describe("enqueueSitemapRegen", () => {
	it("returns undefined and does not throw when queue is undefined", () => {
		const result = enqueueSitemapRegen(undefined);
		expect(result).toBeUndefined();
	});

	it("uses the shared debounce jobId so concurrent enqueues coalesce", async () => {
		const queue = createMockQueue();
		await enqueueSitemapRegen(queue);

		expect(queue.add).toHaveBeenCalledTimes(1);
		const [name, data, opts] = queue.add.mock.calls[0] as [
			string,
			Record<string, unknown>,
			{ jobId?: string },
		];
		expect(name).toBe(SITEMAP_REGEN_JOB_NAME);
		expect(data).toEqual({});
		expect(opts.jobId).toBe(SITEMAP_REGEN_DEBOUNCE_JOB_ID);
	});

	it("propagates `reason` to job data when provided", async () => {
		const queue = createMockQueue();
		await enqueueSitemapRegen(queue, { reason: "event_publish_state_changed" });

		const [, data] = queue.add.mock.calls[0] as [
			string,
			Record<string, unknown>,
			{ jobId?: string },
		];
		expect(data).toEqual({ reason: "event_publish_state_changed" });
	});

	it("respects an explicit jobId override (used by tests, not production)", async () => {
		const queue = createMockQueue();
		await enqueueSitemapRegen(queue, { jobId: "custom" });

		const [, , opts] = queue.add.mock.calls[0] as [
			string,
			Record<string, unknown>,
			{ jobId?: string },
		];
		expect(opts.jobId).toBe("custom");
	});
});

describe("scheduleSitemapRegenCron", () => {
	it("registers a UTC-timezoned repeatable using the default pattern", async () => {
		const queue = createMockQueue();
		await scheduleSitemapRegenCron(queue);

		expect(queue.add).toHaveBeenCalledTimes(1);
		const [name, data, opts] = queue.add.mock.calls[0] as [
			string,
			Record<string, unknown>,
			{ repeat?: { pattern?: string; tz?: string }; jobId?: string },
		];
		expect(name).toBe(SITEMAP_REGEN_JOB_NAME);
		expect(data).toEqual({ reason: "cron" });
		expect(opts.repeat?.pattern).toBe(SITEMAP_REGEN_CRON_PATTERN);
		expect(opts.repeat?.tz).toBe("UTC");
		// Critical: the cron MUST NOT share the debounce jobId — that
		// would conflict with BullMQ's repeatable bookkeeping.
		expect(opts.jobId).toBeUndefined();
	});

	it("accepts a custom cron pattern (for tests / future tuning)", async () => {
		const queue = createMockQueue();
		await scheduleSitemapRegenCron(queue, "*/15 * * * *");

		const [, , opts] = queue.add.mock.calls[0] as [
			string,
			Record<string, unknown>,
			{ repeat?: { pattern?: string } },
		];
		expect(opts.repeat?.pattern).toBe("*/15 * * * *");
	});
});
