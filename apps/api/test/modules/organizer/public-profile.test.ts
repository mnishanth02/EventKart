import type { Database } from "@repo/db";
import { organizerPublicProfileSchema } from "@repo/shared/schemas";
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
const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const REVIEWER_ID = "550e8400-e29b-41d4-a716-446655440099";
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

function setAppDb(app: FastifyInstance, db: Database) {
	Object.defineProperty(app, "db", {
		value: db,
		configurable: true,
		writable: true,
	});
}

/**
 * Build a fully-populated organizer row including every internal field
 * that the public projection MUST strip. Used as the PII-leak fixture.
 */
function buildOrganizerRow(overrides: Record<string, unknown> = {}) {
	return {
		id: ORGANIZER_ID,
		userId: USER_ID,
		slug: "coimbatorerunners",
		businessName: "Coimbatore Runners",
		contactName: "Asha Krishnan",
		contactEmail: "asha@coimbatorerunners.example",
		contactPhone: "+919876543210",
		city: "Coimbatore",
		description:
			"Coimbatore Runners organizes community-first endurance events across Tamil Nadu.",
		website: "https://coimbatorerunners.example",
		verificationStatus: "approved",
		isVerified: true,
		submittedForReviewAt: new Date("2026-04-20T12:00:00.000Z"),
		reviewedAt: new Date("2026-04-25T12:00:00.000Z"),
		reviewedBy: REVIEWER_ID,
		rejectionReason: null,
		razorpayAccountId: "acc_secret_internal_id",
		razorpayAccountStatus: "active",
		razorpayLinkedAt: new Date("2026-04-25T13:00:00.000Z"),
		razorpayRawStatus: "live",
		razorpayLastError: null,
		razorpayLastSyncedAt: new Date("2026-04-26T11:59:00.000Z"),
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

async function injectBySlug(app: FastifyInstance, slug: string) {
	return app.inject({
		method: "GET",
		url: `${ORGANIZERS_URL}/by-slug/${slug}`,
	});
}

describe("GET /api/v1/organizers/by-slug/:slug", () => {
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

	describe("happy path", () => {
		it("returns the organizer projection without leaking internal fields", async () => {
			const { db } = createMockDb([[buildOrganizerRow()]]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "coimbatorerunners");

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body).toEqual({
				success: true,
				data: {
					kind: "organizer",
					data: {
						slug: "coimbatorerunners",
						businessName: "Coimbatore Runners",
						isVerified: true,
						city: "Coimbatore",
						description:
							"Coimbatore Runners organizes community-first endurance events across Tamil Nadu.",
					},
				},
			});

			// Critical-2: exact key set on the projected payload.
			expect(Object.keys(body.data.data).sort()).toEqual([
				"businessName",
				"city",
				"description",
				"isVerified",
				"slug",
			]);

			// Round-trip parse to confirm shape matches the shared contract.
			expect(() =>
				organizerPublicProfileSchema.parse(body.data.data),
			).not.toThrow();
		});

		it("strips every internal organizer field even when all are populated", async () => {
			const { db } = createMockDb([[buildOrganizerRow()]]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "coimbatorerunners");

			expect(response.statusCode).toBe(200);
			const serialized = response.body;

			// PII / internal-state guard. Schema `.parse` already strips, but we
			// assert explicitly so a future projection drift breaks the test.
			const forbiddenSubstrings = [
				ORGANIZER_ID,
				USER_ID,
				REVIEWER_ID,
				"asha@coimbatorerunners.example",
				"Asha Krishnan",
				"+919876543210",
				"acc_secret_internal_id",
				"verificationStatus",
				"razorpayAccountId",
				"razorpayAccountStatus",
				"razorpayRawStatus",
				"razorpayLastError",
				"razorpayLastSyncedAt",
				"reviewedBy",
				"reviewedAt",
				"submittedForReviewAt",
				"rejectionReason",
				"createdAt",
				"updatedAt",
				"contactEmail",
				"contactName",
				"contactPhone",
				"website",
				"userId",
			];
			for (const needle of forbiddenSubstrings) {
				expect(serialized).not.toContain(needle);
			}

			const projected = response.json().data.data;
			expect(projected).not.toHaveProperty("id");
			expect(projected).not.toHaveProperty("userId");
			expect(projected).not.toHaveProperty("contactEmail");
			expect(projected).not.toHaveProperty("contactName");
			expect(projected).not.toHaveProperty("contactPhone");
			expect(projected).not.toHaveProperty("website");
			expect(projected).not.toHaveProperty("verificationStatus");
			expect(projected).not.toHaveProperty("razorpayAccountId");
			expect(projected).not.toHaveProperty("razorpayAccountStatus");
		});

		it("returns isVerified=false for an unverified organizer", async () => {
			const { db } = createMockDb([
				[buildOrganizerRow({ isVerified: false })],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "coimbatorerunners");

			expect(response.statusCode).toBe(200);
			expect(response.json().data.data.isVerified).toBe(false);
		});
	});

	describe("description normalization", () => {
		it("returns null when the stored description is null", async () => {
			const { db } = createMockDb([
				[buildOrganizerRow({ description: null })],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "coimbatorerunners");

			expect(response.statusCode).toBe(200);
			expect(response.json().data.data.description).toBeNull();
		});

		it("normalizes an empty-string description to null", async () => {
			const { db } = createMockDb([[buildOrganizerRow({ description: "" })]]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "coimbatorerunners");

			expect(response.statusCode).toBe(200);
			expect(response.json().data.data.description).toBeNull();
		});

		it("normalizes a whitespace-only description to null", async () => {
			const { db } = createMockDb([
				[buildOrganizerRow({ description: "   \n\t  " })],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "coimbatorerunners");

			expect(response.statusCode).toBe(200);
			expect(response.json().data.data.description).toBeNull();
		});

		it("truncates descriptions longer than 2000 characters to 2000", async () => {
			const { db } = createMockDb([
				[buildOrganizerRow({ description: "a".repeat(3000) })],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "coimbatorerunners");

			expect(response.statusCode).toBe(200);
			const description = response.json().data.data.description;
			expect(description).toHaveLength(2000);
			expect(description).toBe("a".repeat(2000));
		});

		it("does not split a UTF-16 surrogate pair when truncating", async () => {
			// "🏃" (U+1F3C3) encodes as a high+low surrogate pair (2 code units).
			// 1999 ASCII chars + the runner emoji = 2001 raw code units — a naive
			// `slice(0, 2000)` would cut between the surrogates and leak an unpaired
			// high surrogate.
			const padded = `${"a".repeat(1999)}\u{1F3C3}`;
			const { db } = createMockDb([
				[buildOrganizerRow({ description: padded })],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "coimbatorerunners");

			expect(response.statusCode).toBe(200);
			const description: string = response.json().data.data.description;
			expect(description.length).toBeLessThanOrEqual(2000);
			const lastCodeUnit = description.charCodeAt(description.length - 1);
			expect(lastCodeUnit).toBeLessThan(0xd800);
		});
	});

	describe("redirects", () => {
		it("returns a redirect for an old slug whose target organizer still matches", async () => {
			const { db } = createMockDb([
				// First select: organizer-by-slug → miss
				[],
				// Second select: slug_redirects lookup → hit
				[{ resourceId: ORGANIZER_ID, newSlug: "coimbatorerunners" }],
				// Third select: target organizer-by-id → present, slug matches
				[buildOrganizerRow({ slug: "coimbatorerunners" })],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "old-coimbatorerunners");

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				success: true,
				data: { kind: "redirect", newSlug: "coimbatorerunners" },
			});
			// I-2.4.6: Belt-and-suspenders: the redirect signal must not leak the
			// organizer UUID or any other internal identifier.
			expect(response.body).not.toContain(ORGANIZER_ID);
			expect(response.body).not.toContain("organizerId");
			expect(response.body).not.toContain("resourceId");
			// I-2.4.6: Mirror the events redirect-cache directive — short,
			// plain `max-age` so the CDN cannot pin a stale slug rename.
			expect(response.headers["cache-control"]).toBe("public, max-age=300");
		});

		it("returns 404 when the redirect's target organizer row is missing", async () => {
			const { db } = createMockDb([
				[],
				[{ resourceId: ORGANIZER_ID, newSlug: "coimbatorerunners" }],
				// Third select: target organizer-by-id → empty
				[],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "old-coimbatorerunners");

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "NOT_FOUND" },
			});
		});

		it("returns 404 when the target organizer's current slug differs from redirect.newSlug", async () => {
			const { db } = createMockDb([
				[],
				[{ resourceId: ORGANIZER_ID, newSlug: "stale-target-slug" }],
				// Target row exists but its current slug has moved on again.
				[buildOrganizerRow({ slug: "current-different-slug" })],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "old-coimbatorerunners");

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "NOT_FOUND" },
			});
		});

		it("returns 404 when the redirect points back at the requested slug (loop guard)", async () => {
			const { db, select } = createMockDb([
				[],
				[{ resourceId: OTHER_ORGANIZER_ID, newSlug: "self-loop" }],
			]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "self-loop");

			expect(response.statusCode).toBe(404);
			// Loop guard short-circuits before any organizer-by-id lookup runs.
			expect(select).toHaveBeenCalledTimes(2);
		});

		it("returns 404 for an unknown slug with no redirect row", async () => {
			const { db } = createMockDb([[], []]);
			setAppDb(app, db);

			const response = await injectBySlug(app, "no-such-organizer");

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "NOT_FOUND" },
			});
		});
	});

	describe("validation", () => {
		it("returns 400 for a malformed slug", async () => {
			// No DB calls should be made — Fastify rejects at the params
			// validation layer before the handler runs.
			const { db, select } = createMockDb([]);
			setAppDb(app, db);

			const response = await app.inject({
				method: "GET",
				url: `${ORGANIZERS_URL}/by-slug/${encodeURIComponent("@bad slug!")}`,
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "VALIDATION_ERROR" },
			});
			expect(select).not.toHaveBeenCalled();
		});
	});
});
