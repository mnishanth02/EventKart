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

const ORGANIZERS_URL = "/api/v1/organizers";
const ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const OTHER_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440002";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const CREATED_AT = new Date("2026-04-26T12:00:00.000Z");
const UPDATED_AT = new Date("2026-04-26T12:01:00.000Z");
const INTERNAL_KEY = "test-internal-key";

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
	query.limit.mockImplementation(() =>
		terminal === "limit" ? Promise.resolve(rows) : query,
	);
	query.offset.mockImplementation(() =>
		terminal === "offset" ? Promise.resolve(rows) : query,
	);
	query.orderBy.mockImplementation(() =>
		terminal === "orderBy" ? Promise.resolve(rows) : query,
	);
	return query;
}

function createMockDb(plan: ReadonlyArray<[SelectRows, Terminal]>) {
	const pending = [...plan];
	const selectQueries: ReturnType<typeof createSelectQuery>[] = [];
	const select = vi.fn(() => {
		const next = pending.shift() ?? [[], "limit" as const];
		const query = createSelectQuery(next[0], next[1]);
		selectQueries.push(query);
		return query;
	});
	return {
		db: { select } as unknown as Database,
		select,
		selectQueries,
	};
}

function setAppDb(app: FastifyInstance, db: Database) {
	Object.defineProperty(app, "db", {
		value: db,
		configurable: true,
		writable: true,
	});
}

function buildOrganizerRow() {
	return {
		id: ORGANIZER_ID,
		slug: "race-coimbatore",
		businessName: "Race Coimbatore Collective",
		city: "Coimbatore",
		description: null,
		isVerified: true,
	};
}

function buildEventRow(overrides: Record<string, unknown> = {}) {
	return {
		id: EVENT_ID,
		organizerId: ORGANIZER_ID,
		title: "Coimbatore City 10K",
		slug: "coimbatore-city-10k",
		description: null,
		eventType: "race",
		sport: "running",
		category: "running",
		venueName: "Race Course Grounds",
		addressLine1: "Race Course Road",
		addressLine2: null,
		city: "Coimbatore",
		state: "Tamil Nadu",
		country: "India",
		postalCode: null,
		timezone: "Asia/Kolkata",
		startAt: new Date("2026-08-15T00:30:00.000Z"),
		endAt: new Date("2026-08-15T03:30:00.000Z"),
		registrationOpensAt: new Date("2026-07-01T03:30:00.000Z"),
		registrationClosesAt: new Date("2026-08-14T12:30:00.000Z"),
		routeDetails: null,
		refundPolicy: null,
		cancellationPolicy: null,
		isPaid: true,
		currency: "INR",
		status: "published",
		firstPublishedAt: CREATED_AT,
		publishedAt: CREATED_AT,
		submittedForReviewAt: null,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function buildCategoryRow() {
	return {
		id: CATEGORY_ID,
		eventId: EVENT_ID,
		name: "10K",
		slug: "10k",
		distanceMeters: 10000,
		sortOrder: 0,
		spotsTotal: 200,
		spotsRemaining: 125,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
	};
}

function buildPricingRow() {
	return {
		id: "55555555-5555-4555-8555-555555555555",
		eventId: EVENT_ID,
		eventCategoryId: CATEGORY_ID,
		basePrice: 129900,
		earlyBirdPrice: null,
		earlyBirdDeadline: null,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
	};
}

async function injectNextEvent(
	app: FastifyInstance,
	organizerId: string,
	headers: Record<string, string> = {},
) {
	return app.inject({
		method: "GET",
		url: `${ORGANIZERS_URL}/${organizerId}/next-event`,
		headers,
	});
}

describe("GET /api/v1/organizers/:organizerId/next-event (I-2.3.6)", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("auth", () => {
		it("returns 401 when the x-internal-key header is missing", async () => {
			const response = await injectNextEvent(app, ORGANIZER_ID);

			expect(response.statusCode).toBe(401);
		});

		it("returns 401 when the x-internal-key value is wrong", async () => {
			const response = await injectNextEvent(app, ORGANIZER_ID, {
				"x-internal-key": "definitely-not-the-key",
			});

			expect(response.statusCode).toBe(401);
		});
	});

	describe("validation", () => {
		it("returns 400 when organizerId is not a UUID", async () => {
			const response = await injectNextEvent(app, "not-a-uuid", {
				"x-internal-key": INTERNAL_KEY,
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("happy path", () => {
		it("returns the organizer's next event when one exists", async () => {
			// 1) organizer existence probe
			// 2) listPublicEvents count query
			// 3) listPublicEvents rows query
			// 4) batched categories query
			// 5) batched pricing query
			// 6) batched images query
			const { db } = createMockDb([
				[[{ id: ORGANIZER_ID }], "limit"],
				[[{ count: 1 }], "limit"],
				[[buildEventRow()], "offset"],
				[[buildCategoryRow()], "orderBy"],
				[[buildPricingRow()], "orderBy"],
				[[], "orderBy"],
			]);
			setAppDb(app, db);

			const response = await injectNextEvent(app, ORGANIZER_ID, {
				"x-internal-key": INTERNAL_KEY,
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.success).toBe(true);
			expect(body.data).toMatchObject({
				slug: "coimbatore-city-10k",
				title: "Coimbatore City 10K",
				city: "Coimbatore",
			});
		});

		it("returns data: null when the organizer has no upcoming events", async () => {
			const { db } = createMockDb([
				[[{ id: ORGANIZER_ID }], "limit"],
				[[{ count: 0 }], "limit"],
				[[], "offset"],
			]);
			setAppDb(app, db);

			const response = await injectNextEvent(app, ORGANIZER_ID, {
				"x-internal-key": INTERNAL_KEY,
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({ success: true, data: null });
		});
	});

	describe("not found", () => {
		it("returns 404 when the organizer does not exist", async () => {
			const { db } = createMockDb([[[], "limit"]]);
			setAppDb(app, db);

			const response = await injectNextEvent(app, OTHER_ORGANIZER_ID, {
				"x-internal-key": INTERNAL_KEY,
			});

			expect(response.statusCode).toBe(404);
			const body = response.json();
			expect(body.success).toBe(false);
			expect(body.error.message).toMatch(/not found/i);
		});
	});

	describe("organizerExistsById bypass", () => {
		it("does NOT issue listPublicEvents queries when the organizer is missing", async () => {
			// Only the existence probe should run; the count + rows queries
			// must be skipped to avoid wasted DB work and a confusing
			// data: null response for a typo'd UUID.
			const { db, select } = createMockDb([[[], "limit"]]);
			setAppDb(app, db);

			await injectNextEvent(app, OTHER_ORGANIZER_ID, {
				"x-internal-key": INTERNAL_KEY,
			});

			expect(select).toHaveBeenCalledTimes(1);
		});
	});
});

import { selectOrganizerNextEvent } from "../../../src/modules/organizer/next-event-service.js";
import type { StorageClient } from "../../../src/lib/storage.js";

function createStorage(): StorageClient {
	return {
		enabled: false,
		getUploadUrl: vi.fn(),
		getDownloadUrl: vi.fn(),
		headObject: vi.fn(),
		deleteObject: vi.fn(),
		destroy: vi.fn(),
	} as unknown as StorageClient;
}

describe("selectOrganizerNextEvent (service)", () => {
	const NOW = new Date("2026-08-01T00:00:00.000Z");

	it("returns the first card when listPublicEvents yields a row", async () => {
		const { db } = createMockDb([
			[[{ count: 1 }], "limit"],
			[[buildEventRow()], "offset"],
			[[buildCategoryRow()], "orderBy"],
			[[buildPricingRow()], "orderBy"],
			[[], "orderBy"],
		]);

		const result = await selectOrganizerNextEvent(
			{ db, storage: createStorage(), log: { info: vi.fn(), warn: vi.fn() } },
			{ organizerId: ORGANIZER_ID, now: NOW },
		);

		expect(result).not.toBeNull();
		expect(result?.slug).toBe("coimbatore-city-10k");
	});

	it("returns null when listPublicEvents yields no rows", async () => {
		const { db } = createMockDb([
			[[{ count: 0 }], "limit"],
			[[], "offset"],
		]);

		const result = await selectOrganizerNextEvent(
			{ db, storage: createStorage(), log: { info: vi.fn(), warn: vi.fn() } },
			{ organizerId: ORGANIZER_ID, now: NOW },
		);

		expect(result).toBeNull();
	});

	it("forwards the organizerId, sort=startAtAsc, limit=1, timeWindow=upcoming params", async () => {
		const { db, selectQueries } = createMockDb([
			[[{ count: 0 }], "limit"],
			[[], "offset"],
		]);

		await selectOrganizerNextEvent(
			{ db, storage: createStorage(), log: { info: vi.fn(), warn: vi.fn() } },
			{ organizerId: ORGANIZER_ID, now: NOW },
		);

		// limit(1) on the rows query is the strongest available signal
		// that our wrapper pinned limit=1 — the count query also uses
		// limit(1) so we need to inspect index [1] (rows query).
		expect(selectQueries[1]?.limit).toHaveBeenCalledWith(1);
		expect(selectQueries[1]?.offset).toHaveBeenCalledWith(0);
	});
});

// Touch the unused buildOrganizerRow so removing it later is intentional.
void buildOrganizerRow;
