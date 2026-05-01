import type { Database } from "@repo/db";
import { describe, expect, it, vi } from "vitest";
import {
	buildSitemapXml,
	SITEMAP_URL_LIMIT,
} from "../../../src/modules/sitemap/service.js";

/**
 * I-2.4.4 — sitemap service unit tests.
 *
 * The drizzle mock chain follows the explicit-tuple pattern from
 * `apps/api/test/modules/organizer/next-event.test.ts`. Each `select`
 * call shifts a `[rows, terminal]` tuple; `terminal` indicates which
 * chained method resolves the promise (`limit`, `orderBy`, etc.).
 *
 * The service issues exactly two `select` calls in V1: events first,
 * organizers second. Both are terminated by `.limit()` because we cap
 * at `SITEMAP_URL_LIMIT - urlset.length`.
 */

type SelectRows = Record<string, unknown>[];
type Terminal = "limit" | "offset" | "orderBy";

function createSelectQuery(rows: SelectRows, terminal: Terminal) {
	const query = {
		from: vi.fn(),
		limit: vi.fn(),
		offset: vi.fn(),
		orderBy: vi.fn(),
		where: vi.fn(),
	};
	query.from.mockReturnValue(query);
	query.where.mockReturnValue(query);
	query.orderBy.mockImplementation(() =>
		terminal === "orderBy" ? Promise.resolve(rows) : query,
	);
	query.limit.mockImplementation(() =>
		terminal === "limit" ? Promise.resolve(rows) : query,
	);
	query.offset.mockImplementation(() =>
		terminal === "offset" ? Promise.resolve(rows) : query,
	);
	return query;
}

function createMockDb(plan: ReadonlyArray<[SelectRows, Terminal]>) {
	const pending = [...plan];
	const select = vi.fn(() => {
		const next = pending.shift() ?? [[], "limit" as const];
		return createSelectQuery(next[0], next[1]);
	});
	return { select } as unknown as Pick<Database, "select">;
}

const log = { info: vi.fn(), warn: vi.fn() };

const NOW = new Date("2026-04-26T12:00:00.000Z");

describe("buildSitemapXml (I-2.4.4)", () => {
	it("emits an empty urlset (still includes the homepage) when no rows match", async () => {
		const db = createMockDb([
			[[], "limit"],
			[[], "limit"],
		]);

		const xml = await buildSitemapXml(
			{ db, log, cdnBaseUrl: "https://eventkart.in" },
			NOW,
		);

		expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(xml).toContain(
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		);
		expect(xml).toContain("<loc>https://eventkart.in/</loc>");
		expect(xml).toContain("</urlset>");
	});

	it("renders one <url> per published+future event using updatedAt as lastmod", async () => {
		const db = createMockDb([
			[
				[
					{
						slug: "coimbatore-city-10k",
						updatedAt: new Date("2026-04-20T10:00:00.000Z"),
						publishedAt: new Date("2026-04-15T10:00:00.000Z"),
						createdAt: new Date("2026-04-01T10:00:00.000Z"),
					},
					{
						slug: "kochi-marathon",
						updatedAt: null,
						publishedAt: new Date("2026-04-10T10:00:00.000Z"),
						createdAt: new Date("2026-03-15T10:00:00.000Z"),
					},
				],
				"limit",
			],
			[[], "limit"],
		]);

		const xml = await buildSitemapXml(
			{ db, log, cdnBaseUrl: "https://eventkart.in" },
			NOW,
		);

		expect(xml).toContain(
			"<loc>https://eventkart.in/events/coimbatore-city-10k</loc>",
		);
		expect(xml).toContain("<lastmod>2026-04-20T10:00:00+00:00</lastmod>");
		expect(xml).toContain(
			"<loc>https://eventkart.in/events/kochi-marathon</loc>",
		);
		// Falls back to publishedAt when updatedAt is null
		expect(xml).toContain("<lastmod>2026-04-10T10:00:00+00:00</lastmod>");
	});

	it("renders one <url> per verified organizer using updatedAt", async () => {
		const db = createMockDb([
			[[], "limit"],
			[
				[
					{
						slug: "race-coimbatore",
						updatedAt: new Date("2026-04-22T08:00:00.000Z"),
					},
				],
				"limit",
			],
		]);

		const xml = await buildSitemapXml(
			{ db, log, cdnBaseUrl: "https://eventkart.in" },
			NOW,
		);

		expect(xml).toContain(
			"<loc>https://eventkart.in/organizers/race-coimbatore</loc>",
		);
		expect(xml).toContain("<lastmod>2026-04-22T08:00:00+00:00</lastmod>");
	});

	it("warns and uses fallback host when CDN_BASE_URL is undefined", async () => {
		const db = createMockDb([
			[[], "limit"],
			[[], "limit"],
		]);
		const localLog = { info: vi.fn(), warn: vi.fn() };

		const xml = await buildSitemapXml({ db, log: localLog }, NOW);

		expect(localLog.warn).toHaveBeenCalledWith(
			expect.objectContaining({ fallback: "https://eventkart.in" }),
			expect.stringContaining("fallback"),
		);
		expect(xml).toContain("<loc>https://eventkart.in/</loc>");
	});

	it("XML-escapes special chars in slugs defensively", async () => {
		const db = createMockDb([
			[
				[
					{
						slug: "weird&slug",
						updatedAt: new Date("2026-04-20T10:00:00.000Z"),
						publishedAt: null,
						createdAt: new Date("2026-04-01T10:00:00.000Z"),
					},
				],
				"limit",
			],
			[[], "limit"],
		]);

		const xml = await buildSitemapXml(
			{ db, log, cdnBaseUrl: "https://eventkart.in" },
			NOW,
		);

		// `&` MUST be escaped as `&amp;` so the XML is well-formed.
		expect(xml).toContain(
			"<loc>https://eventkart.in/events/weird&amp;slug</loc>",
		);
		expect(xml).not.toContain("weird&slug");
	});

	it("exports SITEMAP_URL_LIMIT = 50000 (sitemaps.org per-file cap)", () => {
		expect(SITEMAP_URL_LIMIT).toBe(50_000);
	});
});
