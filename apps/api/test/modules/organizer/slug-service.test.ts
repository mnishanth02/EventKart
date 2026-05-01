import type { Database } from "@repo/db";
import { organizers, slugRedirects } from "@repo/db/schema";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../src/lib/errors.js";
import {
	generateUniqueOrganizerSlug,
	isReservedOrganizerSlug,
	recordOrganizerSlugRedirect,
	renameOrganizerSlug,
	reserveUniqueOrganizerSlug,
} from "../../../src/modules/organizer/slug-service.js";

const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const OTHER_ORGANIZER_ID = "770e8400-e29b-41d4-a716-446655440002";

type SelectRows = Record<string, unknown>[];

interface SelectQuerySpy {
	from: ReturnType<typeof vi.fn>;
	where: ReturnType<typeof vi.fn>;
	limit: ReturnType<typeof vi.fn>;
}

function createSelectQuery(rows: SelectRows): SelectQuerySpy {
	const query: SelectQuerySpy = {
		from: vi.fn(),
		where: vi.fn(),
		limit: vi.fn(),
	};
	query.from.mockReturnValue(query);
	query.where.mockReturnValue(query);
	query.limit.mockResolvedValue(rows);
	return query;
}

function createMockDb(selectResults: SelectRows[] = []) {
	const pendingSelectResults = [...selectResults];
	const selectCalls: SelectQuerySpy[] = [];

	const insertOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
	const insertValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: insertOnConflictDoUpdate,
	});
	const insert = vi.fn().mockReturnValue({ values: insertValues });

	const deleteWhere = vi.fn().mockResolvedValue(undefined);
	const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });

	const updateWhere = vi.fn().mockResolvedValue(undefined);
	const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
	const update = vi.fn().mockReturnValue({ set: updateSet });

	const select = vi.fn(() => {
		const rows = pendingSelectResults.shift() ?? [];
		const query = createSelectQuery(rows);
		selectCalls.push(query);
		return query;
	});

	let db: Database;
	const txArgs: unknown[] = [];
	const transaction = vi.fn(
		async (callback: (tx: Database) => Promise<unknown>) => {
			txArgs.push(db);
			return callback(db);
		},
	);

	db = {
		delete: deleteFn,
		insert,
		select,
		transaction,
		update,
	} as unknown as Database;

	return {
		db,
		deleteFn,
		deleteWhere,
		insert,
		insertOnConflictDoUpdate,
		insertValues,
		select,
		selectCalls,
		transaction,
		txArgs,
		update,
		updateSet,
		updateWhere,
	};
}

describe("isReservedOrganizerSlug", () => {
	it("returns true for an exact reserved slug", () => {
		expect(isReservedOrganizerSlug("admin")).toBe(true);
	});

	it("is case-insensitive", () => {
		expect(isReservedOrganizerSlug("ADMIN")).toBe(true);
		expect(isReservedOrganizerSlug("Admin")).toBe(true);
	});

	it("returns false for a non-reserved slug", () => {
		expect(isReservedOrganizerSlug("coimbatore-runners")).toBe(false);
	});
});

describe("reserveUniqueOrganizerSlug", () => {
	it("returns the normalized base slug when nothing else owns it", async () => {
		const { db, select } = createMockDb([[], []]);

		const slug = await reserveUniqueOrganizerSlug(db, "Coimbatore Runners");

		expect(slug).toBe("coimbatore-runners");
		// One select for organizers, one for slug_redirects.
		expect(select).toHaveBeenCalledTimes(2);
	});

	it("skips a reserved candidate and returns the next attempt with a -2 suffix", async () => {
		// "admin" is reserved → skipped before any DB lookup.
		// Attempt 2 ("admin-2") then performs both selects, both empty.
		const { db, select } = createMockDb([[], []]);

		const slug = await reserveUniqueOrganizerSlug(db, "admin");

		expect(slug).toBe("admin-2");
		expect(select).toHaveBeenCalledTimes(2);
	});

	it("advances to the next attempt when an active organizer already owns the slug", async () => {
		// Attempt 1: organizers select returns a row → collision, slug_redirects not queried.
		// Attempt 2: organizers + slug_redirects both empty → success.
		const { db, select } = createMockDb([[{ id: OTHER_ORGANIZER_ID }], [], []]);

		const slug = await reserveUniqueOrganizerSlug(db, "Chennai Runners");

		expect(slug).toBe("chennai-runners-2");
		expect(select).toHaveBeenCalledTimes(3);
	});

	it("advances to the next attempt when slug_redirects.old_slug collides for the organizer resourceType", async () => {
		// Attempt 1: organizers empty, slug_redirects returns a row → collision.
		// Attempt 2: organizers + slug_redirects empty → success.
		const { db, select } = createMockDb([
			[],
			[{ id: "880e8400-e29b-41d4-a716-446655440003" }],
			[],
			[],
		]);

		const slug = await reserveUniqueOrganizerSlug(db, "Chennai Runners");

		expect(slug).toBe("chennai-runners-2");
		expect(select).toHaveBeenCalledTimes(4);
	});

	it("returns the base slug when the only owners are the excluded organizer", async () => {
		// With excludeOrganizerId provided, both lookups filter out that organizer
		// — we simulate the filtered queries returning no rows and assert that
		// the function returns the base slug rather than appending a suffix.
		const { db, selectCalls } = createMockDb([[], []]);

		const slug = await reserveUniqueOrganizerSlug(db, "Coimbatore Runners", {
			excludeOrganizerId: TEST_ORGANIZER_ID,
		});

		expect(slug).toBe("coimbatore-runners");
		// Sanity check: where() received a non-null Drizzle SQL expression for
		// each lookup (the expression embeds ne(...) when excludeOrganizerId
		// is supplied).
		expect(selectCalls).toHaveLength(2);
		for (const call of selectCalls) {
			expect(call.where).toHaveBeenCalledTimes(1);
			expect(call.where.mock.calls[0]?.[0]).toBeTruthy();
		}
	});

	it("throws ConflictError when every attempt collides until maxAttempts is exhausted", async () => {
		// Attempts 1 and 2 both report an organizer-table collision.
		const { db } = createMockDb([
			[{ id: OTHER_ORGANIZER_ID }],
			[{ id: OTHER_ORGANIZER_ID }],
		]);

		await expect(
			reserveUniqueOrganizerSlug(db, "Chennai Runners", { maxAttempts: 2 }),
		).rejects.toThrow(ConflictError);

		await expect(
			reserveUniqueOrganizerSlug(
				createMockDb([
					[{ id: OTHER_ORGANIZER_ID }],
					[{ id: OTHER_ORGANIZER_ID }],
				]).db,
				"Chennai Runners",
				{ maxAttempts: 2 },
			),
		).rejects.toThrow(/Unable to reserve a unique organizer slug after/);
	});

	it("throws RangeError for invalid maxAttempts (zero, negative, non-integer)", async () => {
		const { db } = createMockDb();

		await expect(
			reserveUniqueOrganizerSlug(db, "anything", { maxAttempts: 0 }),
		).rejects.toThrow(RangeError);
		await expect(
			reserveUniqueOrganizerSlug(db, "anything", { maxAttempts: -1 }),
		).rejects.toThrow(RangeError);
		await expect(
			reserveUniqueOrganizerSlug(db, "anything", { maxAttempts: 1.5 }),
		).rejects.toThrow(RangeError);
	});
});

describe("generateUniqueOrganizerSlug", () => {
	it("delegates to reserveUniqueOrganizerSlug (identical happy-path output)", async () => {
		const aliasMock = createMockDb([[], []]);
		const directMock = createMockDb([[], []]);

		const aliasSlug = await generateUniqueOrganizerSlug(
			aliasMock.db,
			"Coimbatore Runners",
		);
		const directSlug = await reserveUniqueOrganizerSlug(
			directMock.db,
			"Coimbatore Runners",
		);

		expect(aliasSlug).toBe(directSlug);
		expect(aliasSlug).toBe("coimbatore-runners");
	});
});

describe("recordOrganizerSlugRedirect", () => {
	it("returns { recorded: false } and performs zero db calls when oldSlug === newSlug", async () => {
		const { db, deleteFn, insert, update } = createMockDb();

		const result = await recordOrganizerSlugRedirect(db, {
			organizerId: TEST_ORGANIZER_ID,
			oldSlug: "coimbatore-runners",
			newSlug: "coimbatore-runners",
		});

		expect(result).toEqual({ recorded: false });
		expect(deleteFn).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("on a real rename: deletes prior row, re-points previous redirects, and upserts the new redirect", async () => {
		const {
			db,
			deleteFn,
			deleteWhere,
			insert,
			insertOnConflictDoUpdate,
			insertValues,
			update,
			updateSet,
			updateWhere,
		} = createMockDb();

		const result = await recordOrganizerSlugRedirect(db, {
			organizerId: TEST_ORGANIZER_ID,
			oldSlug: "coimbatore-runners",
			newSlug: "chennai-runners",
		});

		expect(result).toEqual({ recorded: true });

		expect(deleteFn).toHaveBeenCalledTimes(1);
		expect(deleteFn).toHaveBeenCalledWith(slugRedirects);
		expect(deleteWhere).toHaveBeenCalledTimes(1);

		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith(slugRedirects);
		expect(updateSet).toHaveBeenCalledWith({ newSlug: "chennai-runners" });
		expect(updateWhere).toHaveBeenCalledTimes(1);

		expect(insert).toHaveBeenCalledTimes(1);
		expect(insert).toHaveBeenCalledWith(slugRedirects);
		expect(insertValues).toHaveBeenCalledWith({
			oldSlug: "coimbatore-runners",
			newSlug: "chennai-runners",
			resourceType: "organizer",
			resourceId: TEST_ORGANIZER_ID,
		});
		expect(insertOnConflictDoUpdate).toHaveBeenCalledWith({
			target: [slugRedirects.resourceType, slugRedirects.oldSlug],
			set: {
				newSlug: "chennai-runners",
				resourceId: TEST_ORGANIZER_ID,
			},
		});
	});
});

describe("renameOrganizerSlug", () => {
	it("throws NotFoundError when the initial select returns no row", async () => {
		const { db, transaction } = createMockDb([[]]);

		await expect(
			renameOrganizerSlug(db, TEST_ORGANIZER_ID, "Chennai Runners"),
		).rejects.toThrow(NotFoundError);
		expect(transaction).toHaveBeenCalledTimes(1);
	});

	it("returns { slug, previousSlug } without writing when the reserved slug equals the existing slug", async () => {
		// 1) select organizer → existing slug
		// 2) reserveUniqueOrganizerSlug: organizers select empty
		// 3) reserveUniqueOrganizerSlug: slug_redirects select empty
		// → reservation returns "coimbatore-runners" which equals previousSlug → no-op write.
		const { db, insert, update, transaction } = createMockDb([
			[{ slug: "coimbatore-runners" }],
			[],
			[],
		]);

		const result = await renameOrganizerSlug(
			db,
			TEST_ORGANIZER_ID,
			"Coimbatore Runners",
		);

		expect(result).toEqual({
			slug: "coimbatore-runners",
			previousSlug: "coimbatore-runners",
		});
		expect(transaction).toHaveBeenCalledTimes(1);
		// No organizer row update and no redirect insert.
		expect(update).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("updates the organizer row and records a redirect when previousSlug is non-null and different", async () => {
		const { db, insert, insertValues, transaction, txArgs, update, updateSet } =
			createMockDb([[{ slug: "coimbatore-runners" }], [], []]);

		const result = await renameOrganizerSlug(
			db,
			TEST_ORGANIZER_ID,
			"Chennai Runners",
		);

		expect(result).toEqual({
			slug: "chennai-runners",
			previousSlug: "coimbatore-runners",
		});

		expect(transaction).toHaveBeenCalledTimes(1);
		// The tx passed to the transaction callback is the same db object the
		// inner functions operate on.
		expect(txArgs).toHaveLength(1);
		expect(txArgs[0]).toBe(db);

		// One organizers update + one slug_redirects update (inside record).
		expect(update).toHaveBeenCalledTimes(2);
		expect(update).toHaveBeenNthCalledWith(1, organizers);
		expect(update).toHaveBeenNthCalledWith(2, slugRedirects);
		expect(updateSet).toHaveBeenNthCalledWith(1, { slug: "chennai-runners" });

		expect(insert).toHaveBeenCalledTimes(1);
		expect(insert).toHaveBeenCalledWith(slugRedirects);
		expect(insertValues).toHaveBeenCalledWith({
			oldSlug: "coimbatore-runners",
			newSlug: "chennai-runners",
			resourceType: "organizer",
			resourceId: TEST_ORGANIZER_ID,
		});
	});
});
