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
import {
	StorageUnavailableError,
	type StorageClient,
} from "../../../src/lib/storage.js";
import { buildTestApp } from "../../helpers/build-app.js";

const EVENTS_URL = "/api/v1/events";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_EVENT_ID = "99999999-9999-4999-8999-999999999999";
const ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const CATEGORY_5K_ID = "22222222-2222-4222-8222-222222222222";
const CATEGORY_10K_ID = "33333333-3333-4333-8333-333333333333";
const CREATED_AT = new Date("2026-04-26T12:00:00.000Z");
const UPDATED_AT = new Date("2026-04-26T12:01:00.000Z");

type SelectRows = Record<string, unknown>[];

function createSelectQuery(rows: SelectRows) {
	const query = {
		from: vi.fn(),
		limit: vi.fn(),
		orderBy: vi.fn(),
		where: vi.fn(),
	};

	query.from.mockReturnValue(query);
	query.where.mockReturnValue(query);
	query.limit.mockResolvedValue(rows);
	query.orderBy.mockResolvedValue(rows);

	return query;
}

function createMockDb(selectRows: SelectRows[]) {
	const pendingSelectRows = [...selectRows];
	const selectQueries: ReturnType<typeof createSelectQuery>[] = [];
	const select = vi.fn(() => {
		const query = createSelectQuery(pendingSelectRows.shift() ?? []);
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

function setAppDeps(
	app: FastifyInstance,
	db: Database,
	storage = createStorage(),
) {
	Object.defineProperty(app, "db", {
		value: db,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(app, "storage", {
		value: storage,
		configurable: true,
		writable: true,
	});
}

function buildEventRow(overrides: Record<string, unknown> = {}) {
	return {
		id: EVENT_ID,
		organizerId: ORGANIZER_ID,
		title: "Coimbatore City 10K",
		slug: "coimbatore-city-10k",
		description:
			"A paid running event for Coimbatore runners with a clearly marked city route.",
		eventType: "race",
		sport: "running",
		category: "running",
		venueName: "Race Course Grounds",
		addressLine1: "Race Course Road, Gopalapuram",
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
		routeDetails: "Single-loop 10K route through Race Course Road.",
		refundPolicy:
			"Refunds are available until seven days before race day, less payment gateway fees.",
		cancellationPolicy:
			"If the event is cancelled by the organizer, participants receive a refund.",
		isPaid: true,
		currency: "INR",
		status: "published",
		firstPublishedAt: new Date("2026-04-26T12:00:00.000Z"),
		publishedAt: new Date("2026-04-26T12:00:00.000Z"),
		submittedForReviewAt: null,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function buildOrganizerSummaryRow(overrides: Record<string, unknown> = {}) {
	return {
		slug: "coimbatorerunners",
		businessName: "Coimbatore Runners",
		isVerified: true,
		city: "Coimbatore",
		description:
			"Coimbatore Runners organizes community-first endurance events across Tamil Nadu.",
		...overrides,
	};
}

function buildCategoryRows() {
	return [
		{
			id: CATEGORY_5K_ID,
			eventId: EVENT_ID,
			name: "5K",
			slug: "5k",
			distanceMeters: 5000,
			sortOrder: 0,
			spotsTotal: 100,
			spotsRemaining: 95,
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
		},
		{
			id: CATEGORY_10K_ID,
			eventId: EVENT_ID,
			name: "10K",
			slug: "10k",
			distanceMeters: 10_000,
			sortOrder: 1,
			spotsTotal: 200,
			spotsRemaining: 190,
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
		},
	];
}

function buildPricingRows() {
	return [
		{
			id: "44444444-4444-4444-8444-444444444444",
			eventId: EVENT_ID,
			eventCategoryId: CATEGORY_5K_ID,
			basePrice: 999,
			earlyBirdPrice: 799,
			earlyBirdDeadline: new Date("2026-07-01T03:30:00.000Z"),
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
		},
		{
			id: "55555555-5555-4555-8555-555555555555",
			eventId: EVENT_ID,
			eventCategoryId: CATEGORY_10K_ID,
			basePrice: 1499,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
			createdAt: CREATED_AT,
			updatedAt: UPDATED_AT,
		},
	];
}

function buildImageRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "12121212-1212-4121-8121-121212121212",
		eventId: EVENT_ID,
		kind: "hero",
		fileName: "hero.jpg",
		contentType: "image/jpeg",
		sizeBytes: 1_024_000,
		storageKey: `events/images/${EVENT_ID}/hero.jpg`,
		status: "uploaded",
		uploadedBy: "550e8400-e29b-41d4-a716-446655440000",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function publicDetailRows(
	eventOverrides: Record<string, unknown> = {},
	organizerOverrides: Record<string, unknown> = {},
) {
	return [
		[buildEventRow(eventOverrides)],
		[buildOrganizerSummaryRow(organizerOverrides)],
		buildCategoryRows(),
		buildPricingRows(),
		[],
	];
}

async function injectBySlug(app: FastifyInstance, slug: string) {
	return app.inject({
		method: "GET",
		url: `${EVENTS_URL}/by-slug/${slug}`,
	});
}

describe("GET /api/v1/events/by-slug/:slug", () => {
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

	it("returns full public detail for a published event without leaking internal fields", async () => {
		const { db } = createMockDb(publicDetailRows());
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body).toMatchObject({
			success: true,
			data: {
				kind: "event",
				data: {
					slug: "coimbatore-city-10k",
					title: "Coimbatore City 10K",
					organizer: {
						slug: "coimbatorerunners",
						businessName: "Coimbatore Runners",
						isVerified: true,
						city: "Coimbatore",
						description:
							"Coimbatore Runners organizes community-first endurance events across Tamil Nadu.",
					},
					heroImage: null,
					routeMapImage: null,
				},
			},
		});
		const detail = body.data.data;
		expect(detail.organizer).not.toHaveProperty("id");
		expect(detail.organizer).not.toHaveProperty("verificationStatus");
		expect(
			detail.categories.map((category: { slug: string }) => category.slug),
		).toEqual(["5k", "10k"]);
		expect(detail.categories[0]).toMatchObject({
			capacity: { spotsTotal: 100, spotsRemaining: 95 },
		});
		expect(detail.categories[1]).toMatchObject({
			capacity: { spotsTotal: 200, spotsRemaining: 190 },
		});
		expect(detail.categories[0]).not.toHaveProperty("spotsTotal");
		expect(detail.categories[0]).not.toHaveProperty("spotsRemaining");
		const categorySlugs = new Set(
			detail.categories.map((category: { slug: string }) => category.slug),
		);
		expect(
			detail.pricingTiers.every((tier: { categorySlug: string }) =>
				categorySlugs.has(tier.categorySlug),
			),
		).toBe(true);
	});

	it("projects null capacity for a corrupt category row while preserving the rest of the event", async () => {
		const warnSpy = vi.spyOn(app.log, "warn");
		const invalidRows = buildCategoryRows().map((category) =>
			category.id === CATEGORY_5K_ID
				? { ...category, spotsTotal: 10, spotsRemaining: 99 }
				: category,
		);
		const { db } = createMockDb([
			[buildEventRow()],
			[buildOrganizerSummaryRow()],
			invalidRows,
			buildPricingRows(),
			[],
		]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		const categories = response.json().data.data.categories;
		expect(categories).toEqual([
			expect.objectContaining({
				slug: "5k",
				capacity: null,
			}),
			expect.objectContaining({
				slug: "10k",
				capacity: { spotsTotal: 200, spotsRemaining: 190 },
			}),
		]);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				categoryId: CATEGORY_5K_ID,
				spotsTotal: 10,
				spotsRemaining: 99,
			}),
			"Invalid public event category capacity; projecting null capacity",
		);
		warnSpy.mockRestore();
	});

	it("includes a verified organizer description verbatim", async () => {
		const description =
			"Race Coimbatore Collective produces the city's flagship endurance events.";
		const { db } = createMockDb(
			publicDetailRows({}, { isVerified: true, description }),
		);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(response.json().data.data.organizer).toMatchObject({
			isVerified: true,
			description,
		});
	});

	it("returns null organizer description when the database value is null", async () => {
		const { db } = createMockDb(publicDetailRows({}, { description: null }));
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(response.json().data.data.organizer.description).toBeNull();
	});

	it("normalizes an empty organizer description to null", async () => {
		const { db } = createMockDb(publicDetailRows({}, { description: "" }));
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(response.json().data.data.organizer.description).toBeNull();
	});

	it("normalizes a whitespace-only organizer description to null", async () => {
		const { db } = createMockDb(publicDetailRows({}, { description: "   \n  " }));
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(response.json().data.data.organizer.description).toBeNull();
	});

	it("truncates organizer descriptions longer than 2000 characters", async () => {
		const { db } = createMockDb(
			publicDetailRows({}, { description: "a".repeat(2500) }),
		);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		const description = response.json().data.data.organizer.description;
		expect(description).toHaveLength(2000);
		expect(description).toBe("a".repeat(2000));
	});

	it("does not split a UTF-16 surrogate pair when truncating long descriptions", async () => {
		// `\u{1F3C3}` (emoji "🏃") encodes as a high+low surrogate pair (2 code
		// units). With 1999 ASCII chars + the runner emoji, the raw code-unit
		// length is 2001. A naive `slice(0, 2000)` would cut between the
		// surrogates and leak an unpaired high surrogate to the public payload.
		const padded = "a".repeat(1999) + "\u{1F3C3}";
		const { db } = createMockDb(publicDetailRows({}, { description: padded }));
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		const description: string = response.json().data.data.organizer.description;
		expect(description.length).toBeLessThanOrEqual(2000);
		const lastCodeUnit = description.charCodeAt(description.length - 1);
		expect(lastCodeUnit).toBeLessThan(0xd800);
	});

	it("returns full public detail for a completed event", async () => {
		const { db } = createMockDb(publicDetailRows({ status: "completed" }));
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(response.json().data).toMatchObject({
			kind: "event",
			data: { slug: "coimbatore-city-10k" },
		});
	});

	it.each([
		"draft",
		"under_review",
		"rejected",
	] as const)("returns 404 for active non-public %s events", async (status) => {
		const { db } = createMockDb([[buildEventRow({ status })]]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});

	it("returns redirect for an old slug targeting a published event without eventId", async () => {
		const { db } = createMockDb([
			[],
			[{ resourceId: EVENT_ID, newSlug: "coimbatore-city-10k" }],
			[buildEventRow()],
		]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "old-coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: { kind: "redirect", newSlug: "coimbatore-city-10k" },
		});
		expect(JSON.stringify(response.json())).not.toContain("eventId");
	});

	it("returns 404 for an old slug targeting a draft event", async () => {
		const { db } = createMockDb([
			[],
			[{ resourceId: DRAFT_EVENT_ID, newSlug: "draft-event" }],
			[
				buildEventRow({
					id: DRAFT_EVENT_ID,
					slug: "draft-event",
					status: "draft",
				}),
			],
		]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "old-draft-event");

		expect(response.statusCode).toBe(404);
	});

	it("returns 404 for an old slug whose target row is missing", async () => {
		const { db } = createMockDb([
			[],
			[{ resourceId: DRAFT_EVENT_ID, newSlug: "missing-event" }],
			[],
		]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "old-missing-event");

		expect(response.statusCode).toBe(404);
	});

	it("returns direct current slug for a multi-rename redirect chain", async () => {
		const { db } = createMockDb([
			[],
			[{ resourceId: EVENT_ID, newSlug: "coimbatore-city-10k" }],
			[buildEventRow({ slug: "coimbatore-city-10k" })],
		]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-race-a");

		expect(response.statusCode).toBe(200);
		expect(response.json().data).toEqual({
			kind: "redirect",
			newSlug: "coimbatore-city-10k",
		});
	});

	it("returns 404 for a corrupt same-slug redirect row", async () => {
		const { db } = createMockDb([
			[],
			[{ resourceId: EVENT_ID, newSlug: "same-slug" }],
		]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "same-slug");

		expect(response.statusCode).toBe(404);
	});

	it("does not fall through to redirect lookup for an active unpublished current slug", async () => {
		const { db, select } = createMockDb([
			[buildEventRow({ status: "draft", slug: "draft-current" })],
		]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "draft-current");

		expect(response.statusCode).toBe(404);
		expect(select).toHaveBeenCalledTimes(1);
	});

	it("returns 404 for an unknown slug", async () => {
		const { db } = createMockDb([[], []]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "unknown-slug");

		expect(response.statusCode).toBe(404);
	});

	it("returns null image slots when storage is disabled", async () => {
		const { db } = createMockDb(publicDetailRows());
		const storage = createStorage({ enabled: false });
		setAppDeps(app, db, storage);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(response.json().data.data.heroImage).toBeNull();
		expect(response.json().data.data.routeMapImage).toBeNull();
		expect(storage.getDownloadUrl).not.toHaveBeenCalled();
	});

	it("signs latest public images with a 3600 second expiry", async () => {
		const imageRows = [
			buildImageRow({
				id: "22222222-2222-4222-8222-222222222222",
				kind: "hero",
				storageKey: `events/images/${EVENT_ID}/hero-latest.jpg`,
				createdAt: new Date("2026-04-27T12:00:00.000Z"),
			}),
			buildImageRow({
				id: "11111111-1111-4111-8111-111111111111",
				kind: "hero",
				storageKey: `events/images/${EVENT_ID}/hero-old.jpg`,
			}),
			buildImageRow({
				id: "33333333-3333-4333-8333-333333333333",
				kind: "route_map",
				contentType: "image/png",
				storageKey: `events/images/${EVENT_ID}/route-map-latest.png`,
			}),
		];
		const { db } = createMockDb([...publicDetailRows().slice(0, 4), imageRows]);
		const getDownloadUrl = vi.fn(async ({ key, expiresIn }) => ({
			url: `https://cdn.example.com/${encodeURIComponent(key)}`,
			method: "GET" as const,
			key,
			expiresAt: new Date(Date.now() + (expiresIn ?? 0) * 1000),
		}));
		setAppDeps(app, db, createStorage({ enabled: true, getDownloadUrl }));
		const before = Date.now();

		const response = await injectBySlug(app, "coimbatore-city-10k");

		const after = Date.now();
		expect(response.statusCode).toBe(200);
		expect(getDownloadUrl).toHaveBeenCalledWith({
			key: `events/images/${EVENT_ID}/hero-latest.jpg`,
			expiresIn: 3600,
		});
		expect(getDownloadUrl).toHaveBeenCalledWith({
			key: `events/images/${EVENT_ID}/route-map-latest.png`,
			expiresIn: 3600,
		});
		const heroImage = response.json().data.data.heroImage;
		const expiresAtMs = new Date(heroImage.expiresAt).getTime();
		expect(expiresAtMs).toBeGreaterThanOrEqual(before + 3540 * 1000);
		expect(expiresAtMs).toBeLessThanOrEqual(after + 3660 * 1000);
	});

	it("returns null image slots when storage reports unavailable", async () => {
		const { db } = createMockDb([
			...publicDetailRows().slice(0, 4),
			[buildImageRow()],
		]);
		const getDownloadUrl = vi
			.fn()
			.mockRejectedValue(new StorageUnavailableError());
		setAppDeps(app, db, createStorage({ enabled: true, getDownloadUrl }));

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(response.json().data.data.heroImage).toBeNull();
	});

	it("surfaces non-storage-unavailable signing errors as 5xx", async () => {
		const { db } = createMockDb([
			...publicDetailRows().slice(0, 4),
			[buildImageRow()],
		]);
		const getDownloadUrl = vi
			.fn()
			.mockRejectedValue(new Error("signing failed"));
		setAppDeps(app, db, createStorage({ enabled: true, getDownloadUrl }));

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBeGreaterThanOrEqual(500);
		expect(response.statusCode).toBeLessThan(600);
	});
});

describe("GET /api/v1/events/by-slug/:slug — PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=false", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp({
			PUBLIC_SPOTS_REMAINING_BADGE_ENABLED: false,
		});
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("projects null capacity for every category when the feature flag is off", async () => {
		const { db } = createMockDb(publicDetailRows());
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		const body = response.json();
		const categories = body.data.data.categories as {
			slug: string;
			capacity: unknown;
		}[];
		expect(categories.map((c) => c.slug)).toEqual(["5k", "10k"]);
		for (const category of categories) {
			expect(category.capacity).toBeNull();
		}
		// Stored fields must never leak even with the flag off.
		expect(JSON.stringify(body)).not.toContain("spotsTotal");
		expect(JSON.stringify(body)).not.toContain("spotsRemaining");
	});

	it("does not warn for well-formed capacity rows when the feature flag is off", async () => {
		const warnSpy = vi.spyOn(app.log, "warn");
		const { db } = createMockDb(publicDetailRows());
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		expect(warnSpy).not.toHaveBeenCalledWith(
			expect.any(Object),
			"Invalid public event category capacity; projecting null capacity",
		);
		warnSpy.mockRestore();
	});

	it("still projects null and warns for corrupt capacity rows when the feature flag is off", async () => {
		const warnSpy = vi.spyOn(app.log, "warn");
		const invalidRows = buildCategoryRows().map((category) =>
			category.id === CATEGORY_5K_ID
				? { ...category, spotsTotal: 10, spotsRemaining: 99 }
				: category,
		);
		const { db } = createMockDb([
			[buildEventRow()],
			[buildOrganizerSummaryRow()],
			invalidRows,
			buildPricingRows(),
			[],
		]);
		setAppDeps(app, db);

		const response = await injectBySlug(app, "coimbatore-city-10k");

		expect(response.statusCode).toBe(200);
		const categories = response.json().data.data.categories as {
			slug: string;
			capacity: unknown;
		}[];
		// All categories projected as null (corrupt by validation, others by flag).
		for (const category of categories) {
			expect(category.capacity).toBeNull();
		}
		expect(warnSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				categoryId: CATEGORY_5K_ID,
				spotsTotal: 10,
				spotsRemaining: 99,
			}),
			"Invalid public event category capacity; projecting null capacity",
		);
		warnSpy.mockRestore();
	});
});
