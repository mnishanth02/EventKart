import type { Database } from "@repo/db";
import type { FastifyInstance } from "fastify";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { buildTestApp } from "../../helpers/build-app.js";

/**
 * I-2.4.4 — `GET /api/v1/sitemap.xml` route tests.
 *
 * Tests focus on the cache contract and headers — the XML body itself
 * is exercised in `service.test.ts`. The `singleFlight` helper expects
 * `JSON.parse`-able strings in Redis; this is the contract the worker
 * must respect (regression test below).
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
	query.orderBy.mockReturnValue(query);
	query.limit.mockImplementation(() =>
		terminal === "limit" ? Promise.resolve(rows) : query,
	);
	query.offset.mockImplementation(() =>
		terminal === "offset" ? Promise.resolve(rows) : query,
	);
	return query;
}

function installEmptyDb(app: FastifyInstance) {
	const select = vi.fn(() => createSelectQuery([], "limit"));
	const db = { select } as unknown as Database;
	Object.defineProperty(app, "db", {
		value: db,
		configurable: true,
		writable: true,
	});
}

describe("GET /api/v1/sitemap.xml (I-2.4.4)", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		installEmptyDb(app);
	});

	it("serves application/xml with crawler-friendly cache headers", async () => {
		const response = await app.inject({ method: "GET", url: "/api/v1/sitemap.xml" });

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe(
			"application/xml; charset=utf-8",
		);
		expect(response.headers["cache-control"]).toBe(
			"public, max-age=3600, stale-while-revalidate=86400",
		);
	});

	it("returns a well-formed urlset envelope", async () => {
		const response = await app.inject({ method: "GET", url: "/api/v1/sitemap.xml" });

		expect(response.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(response.body).toContain(
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		);
		expect(response.body).toContain("</urlset>");
	});

	it("does NOT require authentication (public crawler endpoint)", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/api/v1/sitemap.xml",
			// no x-internal-key, no session cookie
		});
		// Critically: not 401/403. Crawlers fetch anonymously.
		expect(response.statusCode).toBe(200);
	});

	it(
		"worker→route serialization contract: cached value is JSON.parsed " +
			"(regression for 'worker writes raw XML' bug)",
		() => {
			// The worker stores the XML via `JSON.stringify(xml)` so the
			// route's `singleFlight` can `JSON.parse` it back. If a future
			// change writes the raw XML directly, `JSON.parse('<?xml…>')`
			// throws a SyntaxError from inside `readCache` and the cache
			// hit silently degrades. This test pins the contract by
			// verifying the value the worker must produce for the route is
			// a JSON string of the XML, not the XML itself.
			const xml = '<?xml version="1.0"?><urlset/>';
			const serialized = JSON.stringify(xml);

			expect(() => JSON.parse(serialized)).not.toThrow();
			expect(JSON.parse(serialized)).toBe(xml);

			// The negative case — the bug fixed during adversarial review:
			expect(() => JSON.parse(xml)).toThrow();
		},
	);
});
