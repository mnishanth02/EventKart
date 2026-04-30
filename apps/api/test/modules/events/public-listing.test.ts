import { type Database, desc } from "@repo/db";
import type { OrganizerSlug } from "@repo/shared/schemas";
import { describe, expect, it, vi } from "vitest";
import type { StorageClient } from "../../../src/lib/storage.js";
import {
	buildOffsetPaginationMeta,
	listPublicEvents,
} from "../../../src/modules/events/public-listing-service.js";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID_2 = "22222222-2222-4222-8222-222222222222";
const CATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const CATEGORY_ID_2 = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = new Date("2026-04-26T12:00:00.000Z");
const UPDATED_AT = new Date("2026-04-26T12:01:00.000Z");

type SelectRows = Record<string, unknown>[];

function createSelectQuery(rows: SelectRows, index: number) {
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
		index === 0 ? Promise.resolve(rows) : query,
	);
	query.offset.mockResolvedValue(rows);
	query.orderBy.mockImplementation(() =>
		index === 1 ? query : Promise.resolve(rows),
	);

	return query;
}

function createMockDb(selectRows: SelectRows[]) {
	const pendingSelectRows = [...selectRows];
	const selectQueries: ReturnType<typeof createSelectQuery>[] = [];
	const select = vi.fn(() => {
		const query = createSelectQuery(
			pendingSelectRows.shift() ?? [],
			selectQueries.length,
		);
		selectQueries.push(query);
		return query;
	});

	return {
		db: { select } as unknown as Database,
		select,
		selectQueries,
	};
}

function createStorage(overrides: Partial<StorageClient> = {}): StorageClient {
	return {
		enabled: false,
		getUploadUrl: vi.fn(),
		getDownloadUrl: vi.fn(),
		headObject: vi.fn(),
		deleteObject: vi.fn(),
		destroy: vi.fn(),
		...overrides,
	} as StorageClient;
}

function buildEventRow(overrides: Record<string, unknown> = {}) {
	return {
		id: EVENT_ID,
		organizerId: "660e8400-e29b-41d4-a716-446655440001",
		title: "Coimbatore City 10K",
		slug: "coimbatore-city-10k",
		description: "A paid running event.",
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
		routeDetails: "Single-loop 10K route.",
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

function buildCategoryRow(overrides: Record<string, unknown> = {}) {
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
		...overrides,
	};
}

function buildPricingRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "55555555-5555-4555-8555-555555555555",
		eventId: EVENT_ID,
		eventCategoryId: CATEGORY_ID,
		basePrice: 129900,
		earlyBirdPrice: null,
		earlyBirdDeadline: null,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function buildImageRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "66666666-6666-4666-8666-666666666666",
		eventId: EVENT_ID,
		kind: "hero",
		fileName: "hero.jpg",
		contentType: "image/jpeg",
		sizeBytes: 1024,
		storageKey: `events/images/${EVENT_ID}/hero.jpg`,
		status: "uploaded",
		uploadedBy: "550e8400-e29b-41d4-a716-446655440000",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function createDeps(selectRows: SelectRows[], storage = createStorage()) {
	const { db, selectQueries } = createMockDb(selectRows);
	return {
		deps: {
			db,
			storage,
			log: { info: vi.fn(), warn: vi.fn() },
		},
		selectQueries,
	};
}

interface SqlChunk {
	queryChunks?: unknown[];
	value?: unknown;
	name?: string;
	[key: string]: unknown;
}

function flattenSqlChunks(node: unknown, seen = new WeakSet<object>()): {
	columnNames: string[];
	values: unknown[];
} {
	const columnNames: string[] = [];
	const values: unknown[] = [];
	const visit = (n: unknown) => {
		if (n === null || n === undefined) return;
		if (typeof n !== "object") {
			values.push(n);
			return;
		}
		if (n instanceof Date) {
			values.push(n);
			return;
		}
		if (seen.has(n as object)) return;
		seen.add(n as object);
		const obj = n as SqlChunk;
		if (typeof obj.name === "string" && "columnType" in obj) {
			columnNames.push(obj.name);
		}
		if ("value" in obj && Array.isArray(obj.value)) {
			for (const v of obj.value) visit(v);
		} else if ("value" in obj && obj.value !== undefined) {
			visit(obj.value);
		}
		if (Array.isArray(obj.queryChunks)) {
			for (const child of obj.queryChunks) visit(child);
		}
		for (const [key, child] of Object.entries(obj)) {
			if (key === "queryChunks" || key === "value" || key === "table") continue;
			if (typeof child === "object" && child !== null) visit(child);
		}
	};
	visit(node);
	return { columnNames, values };
}

const params = {
	page: 1,
	limit: 20,
	sort: "startAtAsc" as const,
	now: new Date("2026-01-01T00:00:00.000Z"),
};

describe("listPublicEvents", () => {
	it("returns paginated upcoming public cards with deterministic metadata", async () => {
		const { deps } = createDeps([
			[{ count: 21 }],
			[buildEventRow()],
			[buildCategoryRow()],
			[buildPricingRow()],
			[],
		]);

		const result = await listPublicEvents(deps, params);

		expect(result.meta).toEqual({
			page: 1,
			limit: 20,
			total: 21,
			totalPages: 2,
			hasNext: true,
			hasPrev: false,
		});
		expect(result.data).toHaveLength(1);
		expect(result.data[0]).toMatchObject({
			slug: "coimbatore-city-10k",
			title: "Coimbatore City 10K",
			city: "Coimbatore",
			heroImage: null,
		});
	});

	it("projects published events and preserves startAt/id query ordering from the page rows", async () => {
		const first = buildEventRow({
			id: EVENT_ID,
			slug: "same-start-a",
			status: "published",
		});
		const second = buildEventRow({
			id: EVENT_ID_2,
			slug: "same-start-b",
			status: "published",
		});
		const { deps } = createDeps([
			[{ count: 2 }],
			[first, second],
			[
				buildCategoryRow({ eventId: EVENT_ID, id: CATEGORY_ID }),
				buildCategoryRow({ eventId: EVENT_ID_2, id: CATEGORY_ID_2 }),
			],
			[
				buildPricingRow({ eventId: EVENT_ID, eventCategoryId: CATEGORY_ID }),
				buildPricingRow({
					eventId: EVENT_ID_2,
					eventCategoryId: CATEGORY_ID_2,
				}),
			],
			[],
		]);

		const result = await listPublicEvents(deps, params);

		expect(result.data.map((event) => event.slug)).toEqual([
			"same-start-a",
			"same-start-b",
		]);
	});

	it("orders public events by startAt ASC then id ASC for startAtAsc", async () => {
		const first = buildEventRow({
			id: EVENT_ID,
			slug: "same-start-a",
			startAt: new Date("2026-08-15T00:30:00.000Z"),
		});
		const second = buildEventRow({
			id: EVENT_ID_2,
			slug: "same-start-b",
			startAt: new Date("2026-08-15T00:30:00.000Z"),
		});
		const { deps, selectQueries } = createDeps([
			[{ count: 2 }],
			[first, second],
			[
				buildCategoryRow({ eventId: EVENT_ID, id: CATEGORY_ID }),
				buildCategoryRow({ eventId: EVENT_ID_2, id: CATEGORY_ID_2 }),
			],
			[
				buildPricingRow({ eventId: EVENT_ID, eventCategoryId: CATEGORY_ID }),
				buildPricingRow({
					eventId: EVENT_ID_2,
					eventCategoryId: CATEGORY_ID_2,
				}),
			],
			[],
		]);

		const result = await listPublicEvents(deps, {
			...params,
			sort: "startAtAsc",
		});

		expect(selectQueries[1]?.orderBy).toHaveBeenCalledWith(
			expect.objectContaining({ name: "start_at" }),
			expect.objectContaining({ name: "id" }),
		);
		expect(result.data.map((event) => event.slug)).toEqual([
			"same-start-a",
			"same-start-b",
		]);
	});

	it("orders public events by startAt DESC then id DESC for startAtDesc", async () => {
		const first = buildEventRow({
			id: EVENT_ID_2,
			slug: "same-start-b",
			startAt: new Date("2026-08-15T00:30:00.000Z"),
		});
		const second = buildEventRow({
			id: EVENT_ID,
			slug: "same-start-a",
			startAt: new Date("2026-08-15T00:30:00.000Z"),
		});
		const { deps, selectQueries } = createDeps([
			[{ count: 2 }],
			[first, second],
			[
				buildCategoryRow({ eventId: EVENT_ID, id: CATEGORY_ID }),
				buildCategoryRow({ eventId: EVENT_ID_2, id: CATEGORY_ID_2 }),
			],
			[
				buildPricingRow({ eventId: EVENT_ID, eventCategoryId: CATEGORY_ID }),
				buildPricingRow({
					eventId: EVENT_ID_2,
					eventCategoryId: CATEGORY_ID_2,
				}),
			],
			[],
		]);

		const result = await listPublicEvents(deps, {
			...params,
			sort: "startAtDesc",
		});

		expect(selectQueries[1]?.orderBy).toHaveBeenCalledWith(
			desc(expect.objectContaining({ name: "start_at" })),
			desc(expect.objectContaining({ name: "id" })),
		);
		expect(result.data.map((event) => event.slug)).toEqual([
			"same-start-b",
			"same-start-a",
		]);
	});

	it("uses five batched selects for a non-empty page", async () => {
		const { deps, selectQueries } = createDeps([
			[{ count: 1 }],
			[buildEventRow()],
			[buildCategoryRow()],
			[buildPricingRow()],
			[],
		]);

		await listPublicEvents(deps, params);

		expect(selectQueries).toHaveLength(5);
		expect(selectQueries[1]?.offset).toHaveBeenCalledWith(0);
	});

	it("short-circuits batch queries for an empty page and returns totalPages=0 when total=0", async () => {
		const { deps, selectQueries } = createDeps([[{ count: 0 }], []]);

		const result = await listPublicEvents(deps, params);

		expect(result).toEqual({
			data: [],
			meta: {
				page: 1,
				limit: 20,
				total: 0,
				totalPages: 0,
				hasNext: false,
				hasPrev: false,
			},
		});
		expect(selectQueries).toHaveLength(2);
	});

	it("returns empty data for pages beyond total with hasNext=false", async () => {
		const { deps } = createDeps([[{ count: 1 }], []]);

		const result = await listPublicEvents(deps, { ...params, page: 2 });

		expect(result.data).toEqual([]);
		expect(result.meta).toMatchObject({
			page: 2,
			totalPages: 1,
			hasNext: false,
		});
	});

	it("hides category capacity when the public spots flag is disabled", async () => {
		const { deps } = createDeps([
			[{ count: 1 }],
			[buildEventRow()],
			[buildCategoryRow()],
			[buildPricingRow()],
			[],
		]);

		const result = await listPublicEvents(deps, params);

		expect(result.data[0]?.categories[0]?.capacity).toBeNull();
	});

	it("exposes category capacity when the public spots flag is enabled", async () => {
		const { deps } = createDeps([
			[{ count: 1 }],
			[buildEventRow()],
			[buildCategoryRow()],
			[buildPricingRow()],
			[],
		]);

		const result = await listPublicEvents(
			{ ...deps, featureFlags: { spotsRemainingEnabled: true } },
			params,
		);

		expect(result.data[0]?.categories[0]?.capacity).toEqual({
			spotsTotal: 200,
			spotsRemaining: 125,
		});
	});

	it("projects invalid capacity as null and warns", async () => {
		const { deps } = createDeps([
			[{ count: 1 }],
			[buildEventRow()],
			[buildCategoryRow({ spotsTotal: 10, spotsRemaining: 11 })],
			[buildPricingRow()],
			[],
		]);

		const result = await listPublicEvents(
			{ ...deps, featureFlags: { spotsRemainingEnabled: true } },
			params,
		);

		expect(result.data[0]?.categories[0]?.capacity).toBeNull();
		expect(deps.log.warn).toHaveBeenCalledOnce();
	});

	it("uses the latest pre-sorted hero row per event and signs images in parallel", async () => {
		const storage = createStorage({
			enabled: true,
			getDownloadUrl: vi.fn().mockResolvedValue({
				url: "https://cdn.example.com/latest-hero.jpg",
				expiresAt: new Date("2026-08-14T12:00:00.000Z"),
			}),
		});
		const { deps } = createDeps(
			[
				[{ count: 1 }],
				[buildEventRow()],
				[buildCategoryRow()],
				[buildPricingRow()],
				[
					buildImageRow({ id: "99999999-9999-4999-8999-999999999999" }),
					buildImageRow({ id: "88888888-8888-4888-8888-888888888888" }),
				],
			],
			storage,
		);

		const result = await listPublicEvents(deps, params);

		expect(result.data[0]?.heroImage?.url).toBe(
			"https://cdn.example.com/latest-hero.jpg",
		);
		expect(storage.getDownloadUrl).toHaveBeenCalledOnce();
	});
});

describe("buildOffsetPaginationMeta", () => {
	it("uses deterministic empty-list semantics", () => {
		expect(buildOffsetPaginationMeta({ page: 3, limit: 20, total: 0 })).toEqual(
			{
				page: 3,
				limit: 20,
				total: 0,
				totalPages: 0,
				hasNext: false,
				hasPrev: false,
			},
		);
	});
});

describe("listPublicEvents — organizerSlug filter", () => {
	const ORG_A_SLUG = "org-a" as OrganizerSlug;
	const ORG_A_EVENT_1 = "aaaaaaaa-1111-4111-8111-111111111111";
	const ORG_A_EVENT_2 = "aaaaaaaa-2222-4222-8222-222222222222";
	const ORG_A_EVENT_3 = "aaaaaaaa-3333-4333-8333-333333333333";
	const ORG_A_EVENT_5 = "aaaaaaaa-5555-4555-8555-555555555555";

	it("applies the organizers.slug subquery to the count and rows queries", async () => {
		const { deps, selectQueries } = createDeps([[{ count: 0 }], []]);

		await listPublicEvents(deps, { ...params, organizerSlug: ORG_A_SLUG });

		const countWhereArg = selectQueries[0]?.where.mock.calls[0]?.[0];
		const rowsWhereArg = selectQueries[1]?.where.mock.calls[0]?.[0];
		expect(countWhereArg).toBeDefined();
		expect(rowsWhereArg).toBeDefined();

		for (const arg of [countWhereArg, rowsWhereArg]) {
			const { columnNames, values } = flattenSqlChunks(arg);
			expect(columnNames).toContain("status");
			expect(columnNames).toContain("end_at");
			expect(columnNames).toContain("organizer_id");
			expect(columnNames).toContain("slug");
			expect(values).toContain(ORG_A_SLUG);
		}
	});

	it("does NOT add the organizer subquery when organizerSlug is omitted", async () => {
		const { deps, selectQueries } = createDeps([[{ count: 0 }], []]);

		await listPublicEvents(deps, params);

		const countWhereArg = selectQueries[0]?.where.mock.calls[0]?.[0];
		const { columnNames } = flattenSqlChunks(countWhereArg);
		expect(columnNames).not.toContain("slug");
		expect(columnNames).not.toContain("organizer_id");
	});

	it("returns the filtered organizer's events with the filtered total", async () => {
		const orgARows = [
			buildEventRow({
				id: ORG_A_EVENT_1,
				slug: "org-a-race-1",
				title: "Org A Race 1",
			}),
			buildEventRow({
				id: ORG_A_EVENT_2,
				slug: "org-a-race-2",
				title: "Org A Race 2",
			}),
			buildEventRow({
				id: ORG_A_EVENT_3,
				slug: "org-a-race-3",
				title: "Org A Race 3",
			}),
		];
		const { deps } = createDeps([
			[{ count: 3 }],
			orgARows,
			orgARows.map((row, idx) =>
				buildCategoryRow({
					eventId: row.id,
					id: `cccccccc-${idx}${idx}${idx}${idx}-4${idx}${idx}${idx}-8${idx}${idx}${idx}-${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}`,
				}),
			),
			orgARows.map((row, idx) =>
				buildPricingRow({
					id: `bbbbbbbb-${idx}${idx}${idx}${idx}-4${idx}${idx}${idx}-8${idx}${idx}${idx}-${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}`,
					eventId: row.id,
					eventCategoryId: `cccccccc-${idx}${idx}${idx}${idx}-4${idx}${idx}${idx}-8${idx}${idx}${idx}-${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}${idx}`,
				}),
			),
			[],
		]);

		const result = await listPublicEvents(deps, {
			...params,
			organizerSlug: ORG_A_SLUG,
		});

		expect(result.meta.total).toBe(3);
		expect(result.data.map((event) => event.slug)).toEqual([
			"org-a-race-1",
			"org-a-race-2",
			"org-a-race-3",
		]);
	});

	it("returns empty data and zeroed meta when the slug resolves to no organizer", async () => {
		const { deps } = createDeps([[{ count: 0 }], []]);

		const result = await listPublicEvents(deps, {
			...params,
			organizerSlug: "does-not-exist" as OrganizerSlug,
		});

		expect(result).toEqual({
			data: [],
			meta: {
				page: 1,
				limit: 20,
				total: 0,
				totalPages: 0,
				hasNext: false,
				hasPrev: false,
			},
		});
	});

	it("paginates filtered results: page 1 of 5 with limit 2 yields totalPages=3, hasNext", async () => {
		const pageOneRows = [
			buildEventRow({ id: ORG_A_EVENT_1, slug: "org-a-race-1" }),
			buildEventRow({ id: ORG_A_EVENT_2, slug: "org-a-race-2" }),
		];
		const { deps, selectQueries } = createDeps([
			[{ count: 5 }],
			pageOneRows,
			[
				buildCategoryRow({ eventId: ORG_A_EVENT_1, id: CATEGORY_ID }),
				buildCategoryRow({ eventId: ORG_A_EVENT_2, id: CATEGORY_ID_2 }),
			],
			[
				buildPricingRow({ eventId: ORG_A_EVENT_1, eventCategoryId: CATEGORY_ID }),
				buildPricingRow({
					id: "55555555-5555-4555-8555-555555555556",
					eventId: ORG_A_EVENT_2,
					eventCategoryId: CATEGORY_ID_2,
				}),
			],
			[],
		]);

		const result = await listPublicEvents(deps, {
			...params,
			page: 1,
			limit: 2,
			organizerSlug: ORG_A_SLUG,
		});

		expect(result.meta).toEqual({
			page: 1,
			limit: 2,
			total: 5,
			totalPages: 3,
			hasNext: true,
			hasPrev: false,
		});
		expect(result.data).toHaveLength(2);
		expect(selectQueries[1]?.offset).toHaveBeenCalledWith(0);
		expect(selectQueries[1]?.limit).toHaveBeenCalledWith(2);
	});

	it("paginates filtered results: page 3 of 5 with limit 2 yields hasPrev, no hasNext", async () => {
		const pageThreeRows = [
			buildEventRow({ id: ORG_A_EVENT_5, slug: "org-a-race-5" }),
		];
		const { deps, selectQueries } = createDeps([
			[{ count: 5 }],
			pageThreeRows,
			[buildCategoryRow({ eventId: ORG_A_EVENT_5, id: CATEGORY_ID })],
			[
				buildPricingRow({
					eventId: ORG_A_EVENT_5,
					eventCategoryId: CATEGORY_ID,
				}),
			],
			[],
		]);

		const result = await listPublicEvents(deps, {
			...params,
			page: 3,
			limit: 2,
			organizerSlug: ORG_A_SLUG,
		});

		expect(result.meta).toEqual({
			page: 3,
			limit: 2,
			total: 5,
			totalPages: 3,
			hasNext: false,
			hasPrev: true,
		});
		expect(result.data).toHaveLength(1);
		expect(selectQueries[1]?.offset).toHaveBeenCalledWith(4);
	});

	it("respects startAtDesc ordering on filtered results", async () => {
		const orgARows = [
			buildEventRow({
				id: ORG_A_EVENT_2,
				slug: "org-a-race-late",
				startAt: new Date("2026-09-15T00:30:00.000Z"),
			}),
			buildEventRow({
				id: ORG_A_EVENT_1,
				slug: "org-a-race-early",
				startAt: new Date("2026-08-15T00:30:00.000Z"),
			}),
		];
		const { deps, selectQueries } = createDeps([
			[{ count: 2 }],
			orgARows,
			[
				buildCategoryRow({ eventId: ORG_A_EVENT_1, id: CATEGORY_ID }),
				buildCategoryRow({ eventId: ORG_A_EVENT_2, id: CATEGORY_ID_2 }),
			],
			[
				buildPricingRow({ eventId: ORG_A_EVENT_1, eventCategoryId: CATEGORY_ID }),
				buildPricingRow({
					id: "55555555-5555-4555-8555-555555555557",
					eventId: ORG_A_EVENT_2,
					eventCategoryId: CATEGORY_ID_2,
				}),
			],
			[],
		]);

		const result = await listPublicEvents(deps, {
			...params,
			sort: "startAtDesc",
			organizerSlug: ORG_A_SLUG,
		});

		expect(selectQueries[1]?.orderBy).toHaveBeenCalledWith(
			desc(expect.objectContaining({ name: "start_at" })),
			desc(expect.objectContaining({ name: "id" })),
		);
		expect(result.data.map((event) => event.slug)).toEqual([
			"org-a-race-late",
			"org-a-race-early",
		]);
	});

	it("preserves the published-status filter when organizerSlug is provided", async () => {
		const { deps, selectQueries } = createDeps([[{ count: 0 }], []]);

		await listPublicEvents(deps, { ...params, organizerSlug: ORG_A_SLUG });

		const whereArg = selectQueries[1]?.where.mock.calls[0]?.[0];
		const { columnNames, values } = flattenSqlChunks(whereArg);
		expect(columnNames).toContain("status");
		expect(values).toContain("published");
	});

	it("preserves the endAt > now filter when organizerSlug is provided", async () => {
		const { deps, selectQueries } = createDeps([[{ count: 0 }], []]);

		await listPublicEvents(deps, { ...params, organizerSlug: ORG_A_SLUG });

		const whereArg = selectQueries[1]?.where.mock.calls[0]?.[0];
		const { columnNames, values } = flattenSqlChunks(whereArg);
		expect(columnNames).toContain("end_at");
		expect(values).toContain(params.now);
	});
});
