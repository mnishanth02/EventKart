import type { Database } from "@repo/db";
import { slugRedirects } from "@repo/db/schema";
import { describe, expect, it, vi } from "vitest";
import { updateOrganizer } from "../../../src/modules/organizer/service.js";

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";

const organizerRow = {
	id: TEST_ORGANIZER_ID,
	userId: TEST_USER_ID,
	slug: "coimbatore-runners",
	businessName: "Coimbatore Runners",
	contactName: "Ramesh Kumar",
	contactEmail: "ramesh@coimbatorerunners.in",
	contactPhone: "+919876543210",
	city: "Coimbatore",
	description: "Premier running event organizer in Coimbatore",
	website: "https://coimbatorerunners.in",
	verificationStatus: "pending_documents",
	isVerified: false,
	submittedForReviewAt: null,
	reviewedAt: null,
	rejectionReason: null,
	razorpayAccountStatus: "not_started",
	razorpayAccountId: null,
	createdAt: new Date("2026-04-24T00:00:00.000Z"),
	updatedAt: new Date("2026-04-24T00:00:00.000Z"),
};

type SelectRows = Record<string, unknown>[];

function createSelectQuery(rows: SelectRows) {
	const query = {
		from: vi.fn(),
		limit: vi.fn(),
		where: vi.fn(),
	};
	query.from.mockReturnValue(query);
	query.where.mockReturnValue(query);
	query.limit.mockResolvedValue(rows);
	return query;
}

function createMockDb(
	selectResults: SelectRows[] = [],
	updateRows: SelectRows = [],
	insertError?: Error,
) {
	const pendingSelectResults = [...selectResults];
	const insertOnConflictDoUpdate = vi.fn(async () => {
		if (insertError) throw insertError;
	});
	const insertValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: insertOnConflictDoUpdate,
	});
	const insert = vi.fn().mockReturnValue({ values: insertValues });
	const deleteWhere = vi.fn().mockResolvedValue(undefined);
	const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
	const updateReturning = vi.fn().mockResolvedValue(updateRows);
	const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
	const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
	const update = vi.fn().mockReturnValue({ set: updateSet });
	const select = vi.fn(() => {
		const rows = pendingSelectResults.shift() ?? [];
		return createSelectQuery(rows);
	});

	let db: Database;
	const transaction = vi.fn(
		async (callback: (tx: Database) => Promise<unknown>) => callback(db),
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
		insert,
		insertOnConflictDoUpdate,
		insertValues,
		select,
		transaction,
		update,
		updateSet,
	};
}

describe("updateOrganizer", () => {
	it("updates businessName, regenerates slug, and records redirect in one transaction", async () => {
		const {
			db,
			insertOnConflictDoUpdate,
			insertValues,
			transaction,
			updateSet,
		} = createMockDb(
			[
				[
					{
						id: TEST_ORGANIZER_ID,
						slug: "coimbatore-runners",
						businessName: "Coimbatore Runners",
					},
				],
				[],
				[],
			],
			[
				{
					...organizerRow,
					businessName: "Chennai Runners",
					slug: "chennai-runners",
				},
			],
		);

		const result = await updateOrganizer(
			{ db, log: { info: vi.fn() } },
			TEST_USER_ID,
			{ businessName: "Chennai Runners" },
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				businessName: "Chennai Runners",
				slug: "chennai-runners",
			}),
		);
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
		expect(result).toMatchObject({
			businessName: "Chennai Runners",
			slug: "chennai-runners",
		});
	});

	it("does not change slug or write redirect when the regenerated slug is unchanged", async () => {
		const { db, insert, updateSet } = createMockDb(
			[
				[
					{
						id: TEST_ORGANIZER_ID,
						slug: "coimbatore-runners",
						businessName: "Coimbatore Runners",
					},
				],
				[],
				[],
			],
			[
				{
					...organizerRow,
					businessName: "Coimbatore  Runners",
					slug: "coimbatore-runners",
				},
			],
		);

		await updateOrganizer({ db, log: { info: vi.fn() } }, TEST_USER_ID, {
			businessName: "Coimbatore  Runners",
		});

		expect(updateSet).toHaveBeenCalledWith({
			businessName: "Coimbatore  Runners",
		});
		expect(insert).not.toHaveBeenCalled();
	});

	it("suffixes the regenerated slug when a concurrent organizer already owns the base", async () => {
		const { db, insertValues, updateSet } = createMockDb(
			[
				[
					{
						id: TEST_ORGANIZER_ID,
						slug: "coimbatore-runners",
						businessName: "Coimbatore Runners",
					},
				],
				[{ id: "770e8400-e29b-41d4-a716-446655440002" }],
				[],
				[],
				[],
			],
			[
				{
					...organizerRow,
					businessName: "Chennai Runners",
					slug: "chennai-runners-2",
				},
			],
		);

		await updateOrganizer({ db, log: { info: vi.fn() } }, TEST_USER_ID, {
			businessName: "Chennai Runners",
		});

		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "chennai-runners-2" }),
		);
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				oldSlug: "coimbatore-runners",
				newSlug: "chennai-runners-2",
			}),
		);
	});

	it("propagates redirect insert failure from the transaction so slug changes are not committed separately", async () => {
		const { db, transaction, updateSet } = createMockDb(
			[
				[
					{
						id: TEST_ORGANIZER_ID,
						slug: "coimbatore-runners",
						businessName: "Coimbatore Runners",
					},
				],
				[],
				[],
			],
			[
				{
					...organizerRow,
					businessName: "Chennai Runners",
					slug: "chennai-runners",
				},
			],
			new Error("redirect insert failed"),
		);

		await expect(
			updateOrganizer({ db, log: { info: vi.fn() } }, TEST_USER_ID, {
				businessName: "Chennai Runners",
			}),
		).rejects.toThrow("redirect insert failed");

		expect(transaction).toHaveBeenCalledOnce();
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "chennai-runners" }),
		);
	});
});
