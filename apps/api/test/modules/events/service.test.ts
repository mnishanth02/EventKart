import type { Database } from "@repo/db";
import { slugRedirects } from "@repo/db/schema";
import { EVENT_SLUG_MAX_LENGTH } from "@repo/shared/utils";
import { describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	NotFoundError,
	ValidationError,
} from "../../../src/lib/errors.js";
import {
	createDraftEvent,
	type EventSlugStore,
	type EventSlugTransactionalStore,
	recordEventSlugRedirect,
	reserveUniqueEventSlug,
	updateEventSlug,
} from "../../../src/modules/events/service.js";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

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

function createMockSlugStore(
	selectResults: SelectRows[] = [],
	updateRows: SelectRows = [],
	insertRows: SelectRows = [],
) {
	const pendingSelectResults = [...selectResults];
	const selectQueries: ReturnType<typeof createSelectQuery>[] = [];
	const insertOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
	const insertReturning = vi.fn().mockResolvedValue(insertRows);
	const insertValues = vi.fn().mockReturnValue({
		onConflictDoUpdate: insertOnConflictDoUpdate,
		returning: insertReturning,
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
		const query = createSelectQuery(rows);
		selectQueries.push(query);
		return query;
	});

	let db: EventSlugTransactionalStore;
	const transaction = vi.fn(
		async (callback: (tx: EventSlugStore) => Promise<unknown>) => callback(db),
	);

	db = {
		delete: deleteFn,
		insert,
		select,
		transaction,
		update,
	} as unknown as EventSlugTransactionalStore;

	return {
		db,
		deleteFn,
		deleteWhere,
		insert,
		insertOnConflictDoUpdate,
		insertReturning,
		insertValues,
		select,
		selectQueries,
		transaction,
		update,
		updateReturning,
		updateSet,
		updateWhere,
	};
}

function asDatabase(db: EventSlugTransactionalStore): Database {
	return db as unknown as Database;
}

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";

const validCreateEventInput = {
	title: "Coimbatore City 10K",
	description:
		"A paid running event for Coimbatore runners with a clearly marked city route.",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road, Gopalapuram",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails: "Single-loop 10K route through Race Course Road.",
};

const organizerRow = {
	id: TEST_ORGANIZER_ID,
	userId: TEST_USER_ID,
	businessName: "CoimbatoreRunners",
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

function buildEventRow(overrides: Record<string, unknown> = {}) {
	return {
		id: EVENT_ID,
		organizerId: TEST_ORGANIZER_ID,
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
		isPaid: true,
		currency: "INR",
		status: "draft",
		createdAt: new Date("2026-04-26T12:00:00.000Z"),
		updatedAt: new Date("2026-04-26T12:00:00.000Z"),
		...overrides,
	};
}

describe("event slug service", () => {
	it("generates a suffix when an active event already uses the base slug", async () => {
		const { db, select } = createMockSlugStore([
			[{ id: "existing-event" }],
			[],
			[],
		]);

		const slug = await reserveUniqueEventSlug(db, "Annual Meetup");

		expect(slug).toBe("annual-meetup-2");
		expect(select).toHaveBeenCalledTimes(3);
	});

	it("generates a suffix when a historical event redirect uses the base slug", async () => {
		const { db, select } = createMockSlugStore([
			[],
			[{ id: "existing-redirect" }],
			[],
			[],
		]);

		const slug = await reserveUniqueEventSlug(db, "Archived Meetup");

		expect(slug).toBe("archived-meetup-2");
		expect(select).toHaveBeenCalledTimes(4);
	});

	it("allows an event to reuse its own historical redirect slug", async () => {
		const { db, select } = createMockSlugStore([[], []]);

		const slug = await reserveUniqueEventSlug(db, "Previous Slug", {
			excludeEventId: EVENT_ID,
		});

		expect(slug).toBe("previous-slug");
		expect(select).toHaveBeenCalledTimes(2);
	});

	it("keeps deterministic suffix attempts within the shared slug max length", async () => {
		const base = "a".repeat(EVENT_SLUG_MAX_LENGTH);
		const { db } = createMockSlugStore([[{ id: "existing-event" }], [], []]);

		const slug = await reserveUniqueEventSlug(db, base);

		expect(slug).toHaveLength(EVENT_SLUG_MAX_LENGTH);
		expect(slug).toBe(`${"a".repeat(EVENT_SLUG_MAX_LENGTH - 2)}-2`);
	});

	it("does not update the event or insert a redirect when the slug is unchanged", async () => {
		const { db, insert, transaction, update } = createMockSlugStore([[], []]);

		const result = await updateEventSlug(db, {
			eventId: EVENT_ID,
			currentSlug: "current-slug",
			slugCandidate: "Current Slug",
		});

		expect(result).toEqual({
			changed: false,
			previousSlug: "current-slug",
			slug: "current-slug",
		});
		expect(transaction).toHaveBeenCalledOnce();
		expect(update).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("updates the event slug and records a redirect when the slug changes", async () => {
		const { db, insertOnConflictDoUpdate, insertValues, updateSet } =
			createMockSlugStore([[], []], [{ slug: "new-name" }]);

		const result = await updateEventSlug(db, {
			eventId: EVENT_ID,
			currentSlug: "old-name",
			slugCandidate: "New Name",
		});

		expect(result).toEqual({
			changed: true,
			previousSlug: "old-name",
			slug: "new-name",
		});
		expect(updateSet).toHaveBeenCalledWith({ slug: "new-name" });
		expect(updateSet).toHaveBeenCalledWith({ newSlug: "new-name" });
		expect(insertValues).toHaveBeenCalledWith({
			oldSlug: "old-name",
			newSlug: "new-name",
			resourceType: "event",
			resourceId: EVENT_ID,
		});
		expect(insertOnConflictDoUpdate).toHaveBeenCalledWith({
			target: [slugRedirects.resourceType, slugRedirects.oldSlug],
			set: {
				newSlug: "new-name",
				resourceId: EVENT_ID,
			},
		});
	});

	it("does not insert a redirect for no-op redirect recording", async () => {
		const { db, deleteFn, insert, update } = createMockSlugStore();

		const result = await recordEventSlugRedirect(db, {
			eventId: EVENT_ID,
			oldSlug: "same-slug",
			newSlug: "same-slug",
		});

		expect(result).toEqual({ recorded: false });
		expect(deleteFn).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("removes stale current-slug redirects and upserts duplicate old slug redirects", async () => {
		const { db, deleteFn, insertOnConflictDoUpdate, updateSet } =
			createMockSlugStore();

		const result = await recordEventSlugRedirect(db, {
			eventId: EVENT_ID,
			oldSlug: "previous-slug",
			newSlug: "latest-slug",
		});

		expect(result).toEqual({ recorded: true });
		expect(deleteFn).toHaveBeenCalledWith(slugRedirects);
		expect(updateSet).toHaveBeenCalledWith({ newSlug: "latest-slug" });
		expect(insertOnConflictDoUpdate).toHaveBeenCalledWith({
			target: [slugRedirects.resourceType, slugRedirects.oldSlug],
			set: {
				newSlug: "latest-slug",
				resourceId: EVENT_ID,
			},
		});
	});

	it("throws ConflictError when deterministic slug attempts are exhausted", async () => {
		const { db, select } = createMockSlugStore([
			[{ id: "event-1" }],
			[{ id: "event-2" }],
			[{ id: "event-3" }],
		]);

		const promise = reserveUniqueEventSlug(db, "Sold Out Summit", {
			maxAttempts: 3,
		});

		await expect(promise).rejects.toThrow(ConflictError);
		await expect(promise).rejects.toThrow(
			"Unable to reserve a unique event slug after 3 attempts",
		);
		expect(select).toHaveBeenCalledTimes(3);
	});
});

describe("createDraftEvent", () => {
	it("creates a draft paid running event with shared V1 defaults", async () => {
		const { db, insertValues } = createMockSlugStore(
			[[organizerRow], [], []],
			[],
			[buildEventRow()],
		);
		const log = { info: vi.fn() };

		const result = await createDraftEvent(
			{ db: asDatabase(db), log },
			TEST_USER_ID,
			validCreateEventInput,
		);

		expect(result).toMatchObject({
			id: EVENT_ID,
			organizerId: TEST_ORGANIZER_ID,
			slug: "coimbatore-city-10k",
			status: "draft",
			eventType: "race",
			sport: "running",
			category: "running",
			city: "Coimbatore",
			isPaid: true,
			currency: "INR",
		});
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				organizerId: TEST_ORGANIZER_ID,
				slug: "coimbatore-city-10k",
				status: "draft",
				city: "Coimbatore",
				state: "Tamil Nadu",
				country: "India",
				timezone: "Asia/Kolkata",
				isPaid: true,
				currency: "INR",
				startAt: expect.any(Date),
				endAt: expect.any(Date),
			}),
		);
		expect(log.info).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				organizerId: TEST_ORGANIZER_ID,
				userId: TEST_USER_ID,
			}),
			"Draft event created",
		);
	});

	it("returns 404 when the authenticated organizer profile does not exist", async () => {
		const { db, insert } = createMockSlugStore([[]]);

		await expect(
			createDraftEvent(
				{ db: asDatabase(db), log: { info: vi.fn() } },
				TEST_USER_ID,
				validCreateEventInput,
			),
		).rejects.toThrow(NotFoundError);
		expect(insert).not.toHaveBeenCalled();
	});

	it.each([
		["city", { city: "Chennai" }],
		["event type", { eventType: "workshop" }],
		["payment", { isPaid: false }],
		[
			"date order",
			{
				startAt: "2026-08-15T03:30:00.000Z",
				endAt: "2026-08-15T00:30:00.000Z",
			},
		],
	])("rejects invalid V1 %s constraints", async (_name, override) => {
		const { db, select, insert } = createMockSlugStore();

		await expect(
			createDraftEvent(
				{ db: asDatabase(db), log: { info: vi.fn() } },
				TEST_USER_ID,
				{ ...validCreateEventInput, ...override },
			),
		).rejects.toThrow(ValidationError);
		expect(select).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("uses a suffixed slug when the base slug already exists", async () => {
		const { db, insertValues, select } = createMockSlugStore(
			[[organizerRow], [{ id: "existing-event" }], [], []],
			[],
			[buildEventRow({ slug: "coimbatore-city-10k-2" })],
		);

		const result = await createDraftEvent(
			{ db: asDatabase(db), log: { info: vi.fn() } },
			TEST_USER_ID,
			validCreateEventInput,
		);

		expect(result.slug).toBe("coimbatore-city-10k-2");
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "coimbatore-city-10k-2" }),
		);
		expect(select).toHaveBeenCalledTimes(4);
	});
});
