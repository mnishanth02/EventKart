import type { Database } from "@repo/db";
import {
	eventCategories,
	eventPricingTiers,
	slugRedirects,
} from "@repo/db/schema";
import {
	defaultEventRegistrationFormSchema,
	eventPricingConfigSchema,
	eventRegistrationFormSchema,
} from "@repo/shared/schemas";
import { EVENT_SLUG_MAX_LENGTH } from "@repo/shared/utils";
import { describe, expect, it, vi } from "vitest";
import type { AuditLogger } from "../../../src/lib/audit.js";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../../src/lib/errors.js";
import {
	adminApproveEvent,
	adminRejectEvent,
	createDraftEvent,
	type EventSlugStore,
	type EventSlugTransactionalStore,
	getApplicableEventPrice,
	getEvent,
	getEventPolicies,
	getEventRegistrationForm,
	getPublishedPaidEventCount,
	listEventCategories,
	listEventPricing,
	publishEvent,
	recordEventSlugRedirect,
	replaceEventCategories,
	replaceEventPricing,
	requiresAdminReview,
	reserveUniqueEventSlug,
	unpublishEvent,
	updateDraftEvent,
	updateEventPolicies,
	updateEventRegistrationForm,
	updateEventSlug,
	updatePublishedEvent,
} from "../../../src/modules/events/service.js";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_5K_ID = "22222222-2222-4222-8222-222222222222";
const CATEGORY_10K_ID = "33333333-3333-4333-8333-333333333333";
const PRICING_5K_ID = "44444444-4444-4444-8444-444444444444";
const PRICING_10K_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_ORGANIZER_ID = "770e8400-e29b-41d4-a716-446655440002";

type SelectRows = Record<string, unknown>[];

function createSelectQuery(rows: SelectRows) {
	const query = {
		for: vi.fn(),
		from: vi.fn(),
		limit: vi.fn(),
		orderBy: vi.fn(),
		where: vi.fn(),
	};

	query.for.mockReturnValue(query);
	query.from.mockReturnValue(query);
	query.where.mockReturnValue(query);
	query.limit.mockResolvedValue(rows);
	query.orderBy.mockResolvedValue(rows);

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

const validUpdateEventInput = {
	...validCreateEventInput,
	title: "Updated Coimbatore City 10K",
	description:
		"Updated paid running event for Coimbatore runners with clearer route and venue details.",
	venueName: "VOC Park Grounds",
	addressLine1: "VOC Park, Gopalapuram",
	addressLine2: "Gate 2",
	postalCode: "641018",
	routeDetails: "Updated single-loop 10K route through Race Course Road.",
};

const organizerRow = {
	id: TEST_ORGANIZER_ID,
	userId: TEST_USER_ID,
	slug: "coimbatorerunners",
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

const verifiedOrganizerRow = {
	...organizerRow,
	verificationStatus: "approved",
	isVerified: true,
	razorpayAccountStatus: "active",
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
		refundPolicy: null,
		cancellationPolicy: null,
		isPaid: true,
		currency: "INR",
		status: "draft",
		firstPublishedAt: null,
		publishedAt: null,
		submittedForReviewAt: null,
		createdAt: new Date("2026-04-26T12:00:00.000Z"),
		updatedAt: new Date("2026-04-26T12:00:00.000Z"),
		...overrides,
	};
}

const validEventCategoriesInput = {
	categories: [
		{
			name: "10K",
			slug: "10k",
			distanceMeters: 10_000,
			sortOrder: 1,
		},
		{
			name: " 5K ",
			slug: "5k",
			distanceMeters: 5_000,
			sortOrder: 0,
		},
	],
};

function buildEventCategoryRow(overrides: Record<string, unknown> = {}) {
	return {
		id: CATEGORY_5K_ID,
		eventId: EVENT_ID,
		name: "5K",
		slug: "5k",
		distanceMeters: 5_000,
		sortOrder: 0,
		spotsTotal: 100,
		spotsRemaining: 100,
		createdAt: new Date("2026-04-26T12:00:00.000Z"),
		updatedAt: new Date("2026-04-26T12:00:00.000Z"),
		...overrides,
	};
}

function buildEventPricingTierRow(overrides: Record<string, unknown> = {}) {
	return {
		id: PRICING_5K_ID,
		eventId: EVENT_ID,
		eventCategoryId: CATEGORY_5K_ID,
		basePrice: 999,
		earlyBirdPrice: 799,
		earlyBirdDeadline: new Date("2026-07-01T03:30:00.000Z"),
		createdAt: new Date("2026-04-26T12:00:00.000Z"),
		updatedAt: new Date("2026-04-26T12:00:00.000Z"),
		...overrides,
	};
}

function buildHeroImageRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "12121212-1212-4121-8121-121212121212",
		eventId: EVENT_ID,
		kind: "hero",
		fileName: "hero.jpg",
		contentType: "image/jpeg",
		sizeBytes: 1_024_000,
		storageKey: `events/images/${EVENT_ID}/hero.jpg`,
		status: "uploaded",
		uploadedBy: TEST_USER_ID,
		createdAt: new Date("2026-04-26T12:00:00.000Z"),
		updatedAt: new Date("2026-04-26T12:00:00.000Z"),
		...overrides,
	};
}

function createAuditLogger(): AuditLogger {
	return {
		log: vi.fn().mockResolvedValue(undefined),
		logBatch: vi.fn().mockResolvedValue(undefined),
	};
}

function createPublishDeps(db: unknown, auditLogger = createAuditLogger()) {
	return {
		db: db as Database,
		auditLogger,
		log: {
			info: vi.fn(),
		},
		requiresAdminReview: vi.fn().mockResolvedValue(false),
	};
}

const validEventPricingInput = eventPricingConfigSchema.parse({
	tiers: [
		{
			eventCategoryId: CATEGORY_5K_ID,
			basePrice: 999,
			earlyBirdPrice: 799,
			earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
		},
		{
			eventCategoryId: CATEGORY_10K_ID,
			basePrice: 1499,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
		},
	],
});

const validEventPoliciesInput = {
	refundPolicy:
		"Refunds are available until seven days before race day, less payment gateway fees.",
	cancellationPolicy:
		"If the event is cancelled by the organizer, registered participants receive a full refund.",
};

const validRegistrationFormInput = eventRegistrationFormSchema.parse({
	...defaultEventRegistrationFormSchema,
	fields: defaultEventRegistrationFormSchema.fields.map((field) =>
		field.fieldId === "blood_group"
			? {
					...field,
					enabled: true,
					required: true,
					safetyCritical: true,
					safetyCriticalReason:
						"Blood group helps on-site medical staff during emergencies.",
				}
			: field,
	),
});

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

describe("requiresAdminReview", () => {
	it("requires review while organizer has fewer than 3 historically published paid events", async () => {
		const { db } = createMockSlugStore([[{ total: 2 }]]);

		await expect(
			requiresAdminReview(asDatabase(db), TEST_ORGANIZER_ID),
		).resolves.toBe(true);
	});

	it("still requires review at exactly 3 historically published paid events", async () => {
		const { db } = createMockSlugStore([[{ total: 3 }]]);

		await expect(
			requiresAdminReview(asDatabase(db), TEST_ORGANIZER_ID),
		).resolves.toBe(true);
	});

	it("does not require review after more than 3 historically published paid events", async () => {
		const { db } = createMockSlugStore([[{ total: 4 }]]);

		await expect(
			requiresAdminReview(asDatabase(db), TEST_ORGANIZER_ID),
		).resolves.toBe(false);
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

describe("updateDraftEvent", () => {
	it("updates editable details for an organizer-owned draft event", async () => {
		const updatedAt = new Date("2026-04-27T12:00:00.000Z");
		const nonSlugUpdateInput = {
			...validUpdateEventInput,
			title: validCreateEventInput.title,
		};
		const { db, selectQueries, transaction, updateSet } = createMockSlugStore(
			[[organizerRow], [buildEventRow()]],
			[
				buildEventRow({
					...nonSlugUpdateInput,
					slug: "coimbatore-city-10k",
					startAt: new Date(nonSlugUpdateInput.startAt),
					endAt: new Date(nonSlugUpdateInput.endAt),
					registrationOpensAt: new Date(nonSlugUpdateInput.registrationOpensAt),
					registrationClosesAt: new Date(
						nonSlugUpdateInput.registrationClosesAt,
					),
					updatedAt,
				}),
			],
		);
		const log = { info: vi.fn() };

		const result = await updateDraftEvent(
			{ db: asDatabase(db), log },
			TEST_USER_ID,
			EVENT_ID,
			{
				...nonSlugUpdateInput,
				title: `  ${nonSlugUpdateInput.title}  `,
				addressLine2: `  ${nonSlugUpdateInput.addressLine2}  `,
			},
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(selectQueries[1]?.for).toHaveBeenCalledWith("update");
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				title: nonSlugUpdateInput.title,
				description: nonSlugUpdateInput.description,
				venueName: nonSlugUpdateInput.venueName,
				addressLine1: nonSlugUpdateInput.addressLine1,
				addressLine2: nonSlugUpdateInput.addressLine2,
				postalCode: nonSlugUpdateInput.postalCode,
				slug: "coimbatore-city-10k",
				startAt: new Date(nonSlugUpdateInput.startAt),
				endAt: new Date(nonSlugUpdateInput.endAt),
				routeDetails: nonSlugUpdateInput.routeDetails,
				updatedAt: expect.any(Date),
			}),
		);
		expect(result).toMatchObject({
			id: EVENT_ID,
			title: nonSlugUpdateInput.title,
			venueName: nonSlugUpdateInput.venueName,
			addressLine2: nonSlugUpdateInput.addressLine2,
			postalCode: nonSlugUpdateInput.postalCode,
			updatedAt: "2026-04-27T12:00:00.000Z",
		});
		expect(log.info).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				organizerId: TEST_ORGANIZER_ID,
				userId: TEST_USER_ID,
			}),
			"Draft event updated",
		);
	});

	it("updates the slug and records a redirect when the title changes", async () => {
		const { db, insertValues, select, updateSet } = createMockSlugStore(
			[[organizerRow], [buildEventRow()], [], []],
			[
				buildEventRow({
					...validUpdateEventInput,
					slug: "updated-coimbatore-city-10k",
					startAt: new Date(validUpdateEventInput.startAt),
					endAt: new Date(validUpdateEventInput.endAt),
					registrationOpensAt: new Date(
						validUpdateEventInput.registrationOpensAt,
					),
					registrationClosesAt: new Date(
						validUpdateEventInput.registrationClosesAt,
					),
				}),
			],
		);

		const result = await updateDraftEvent(
			{ db: asDatabase(db), log: { info: vi.fn() } },
			TEST_USER_ID,
			EVENT_ID,
			validUpdateEventInput,
		);

		expect(result.slug).toBe("updated-coimbatore-city-10k");
		expect(select).toHaveBeenCalledTimes(4);
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Updated Coimbatore City 10K",
				slug: "updated-coimbatore-city-10k",
			}),
		);
		expect(insertValues).toHaveBeenCalledWith({
			oldSlug: "coimbatore-city-10k",
			newSlug: "updated-coimbatore-city-10k",
			resourceType: "event",
			resourceId: EVENT_ID,
		});
	});

	it("does not record a slug redirect when the normalized title is unchanged", async () => {
		const { db, insert, select, updateSet } = createMockSlugStore(
			[[organizerRow], [buildEventRow()]],
			[buildEventRow()],
		);

		const result = await updateDraftEvent(
			{ db: asDatabase(db), log: { info: vi.fn() } },
			TEST_USER_ID,
			EVENT_ID,
			validCreateEventInput,
		);

		expect(result.slug).toBe("coimbatore-city-10k");
		expect(select).toHaveBeenCalledTimes(2);
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "coimbatore-city-10k" }),
		);
		expect(insert).not.toHaveBeenCalled();
	});

	it("returns 404 when the authenticated organizer profile does not exist", async () => {
		const { db, update } = createMockSlugStore([[]]);

		await expect(
			updateDraftEvent(
				{ db: asDatabase(db), log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validUpdateEventInput,
			),
		).rejects.toThrow(NotFoundError);
		expect(update).not.toHaveBeenCalled();
	});

	it("returns 403 when updating another organizer's event", async () => {
		const { db, update } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ organizerId: OTHER_ORGANIZER_ID })],
		]);

		await expect(
			updateDraftEvent(
				{ db: asDatabase(db), log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validUpdateEventInput,
			),
		).rejects.toThrow(ForbiddenError);
		expect(update).not.toHaveBeenCalled();
	});

	it("returns 409 when updating a non-draft event", async () => {
		const { db, update } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ status: "published" })],
		]);

		await expect(
			updateDraftEvent(
				{ db: asDatabase(db), log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validUpdateEventInput,
			),
		).rejects.toMatchObject({
			code: "PUBLISHED_EVENT_HIGH_RISK_EDIT_REQUIRES_UNPUBLISH",
			details: {
				requiresUnpublish: true,
				highRiskFields: expect.arrayContaining(["title", "startAt"]),
			},
		});
		expect(update).not.toHaveBeenCalled();
	});

	it.each([
		[
			"immutable city",
			{
				city: "Coimbatore",
			},
		],
		[
			"date order",
			{
				startAt: "2026-08-15T03:30:00.000Z",
				endAt: "2026-08-15T00:30:00.000Z",
			},
		],
	])("rejects invalid update payloads for %s before touching the database", async (_name, override) => {
		const { db, select, update } = createMockSlugStore();

		await expect(
			updateDraftEvent(
				{ db: asDatabase(db), log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				{ ...validUpdateEventInput, ...override },
			),
		).rejects.toThrow(ValidationError);
		expect(select).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});
});

describe("updatePublishedEvent", () => {
	it("updates a low-risk description and writes constrained audit metadata", async () => {
		const auditLogger = createAuditLogger();
		const updatedDescription =
			"Updated published event description that is safe to display publicly.";
		const { db, updateSet } = createMockSlugStore(
			[[organizerRow], [buildEventRow({ status: "published" })]],
			[buildEventRow({ status: "published", description: updatedDescription })],
		);

		const result = await updatePublishedEvent(
			{
				db: asDatabase(db),
				log: { info: vi.fn() },
				auditLogger,
			},
			TEST_USER_ID,
			EVENT_ID,
			{ description: updatedDescription },
		);

		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				description: updatedDescription,
				updatedAt: expect.any(Date),
			}),
		);
		expect(result.description).toBe(updatedDescription);
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.update_published",
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					changedFields: ["description"],
					transition: "published_patch",
				},
			}),
		);
		const metadata = vi.mocked(auditLogger.log).mock.calls[0]?.[0].metadata;
		expect(Object.keys(metadata ?? {}).sort()).toEqual([
			"changedFields",
			"organizerId",
			"transition",
		]);
		expect(JSON.stringify(metadata)).not.toContain(updatedDescription);
	});

	it("updates refund and cancellation policies via the published-edit endpoint", async () => {
		const auditLogger = createAuditLogger();
		const refundPolicy =
			"Refunds are available until seven days before the event date.";
		const cancellationPolicy =
			"Cancellations by the organizer receive a full participant refund.";
		const { db, updateSet } = createMockSlugStore(
			[[organizerRow], [buildEventRow({ status: "published" })]],
			[
				buildEventRow({
					status: "published",
					refundPolicy,
					cancellationPolicy,
				}),
			],
		);

		const result = await updatePublishedEvent(
			{
				db: asDatabase(db),
				log: { info: vi.fn() },
				auditLogger,
			},
			TEST_USER_ID,
			EVENT_ID,
			{ refundPolicy, cancellationPolicy },
		);

		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ refundPolicy, cancellationPolicy }),
		);
		expect(result).toMatchObject({ refundPolicy, cancellationPolicy });
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					changedFields: ["refundPolicy", "cancellationPolicy"],
					transition: "published_patch",
				},
			}),
		);
	});

	it("returns structured 409 for high-risk published edits", async () => {
		const { db, update } = createMockSlugStore();

		await expect(
			updatePublishedEvent(
				{
					db: asDatabase(db),
					log: { info: vi.fn() },
					auditLogger: createAuditLogger(),
				},
				TEST_USER_ID,
				EVENT_ID,
				{ title: "High Risk Title" },
			),
		).rejects.toMatchObject({
			code: "PUBLISHED_EVENT_HIGH_RISK_EDIT_REQUIRES_UNPUBLISH",
			statusCode: 409,
			details: {
				requiresUnpublish: true,
				highRiskFields: ["title"],
			},
		});
		expect(update).not.toHaveBeenCalled();
	});

	it("rejects mixed high-risk and low-risk payloads atomically", async () => {
		const originalDescription =
			"A paid running event for Coimbatore runners with a clearly marked city route.";
		const { db, update } = createMockSlugStore();

		await expect(
			updatePublishedEvent(
				{
					db: asDatabase(db),
					log: { info: vi.fn() },
					auditLogger: createAuditLogger(),
				},
				TEST_USER_ID,
				EVENT_ID,
				{
					description:
						"Updated description that must not be persisted when title is present.",
					title: "High Risk Title",
				},
			),
		).rejects.toMatchObject({
			code: "PUBLISHED_EVENT_HIGH_RISK_EDIT_REQUIRES_UNPUBLISH",
			details: {
				requiresUnpublish: true,
				highRiskFields: ["title"],
			},
		});
		expect(update).not.toHaveBeenCalled();
		expect(buildEventRow().description).toBe(originalDescription);
	});

	it("returns 403 for a non-owner organizer", async () => {
		const { db, update } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ status: "published", organizerId: OTHER_ORGANIZER_ID })],
		]);

		await expect(
			updatePublishedEvent(
				{
					db: asDatabase(db),
					log: { info: vi.fn() },
					auditLogger: createAuditLogger(),
				},
				TEST_USER_ID,
				EVENT_ID,
				{ description: "Updated published event description text." },
			),
		).rejects.toThrow(ForbiddenError);
		expect(update).not.toHaveBeenCalled();
	});
});

describe("getEvent", () => {
	it("returns a publicly readable event", async () => {
		const { db } = createMockSlugStore([
			[buildEventRow({ status: "published" })],
		]);

		const result = await getEvent(db, EVENT_ID);

		expect(result).toMatchObject({
			id: EVENT_ID,
			slug: "coimbatore-city-10k",
			status: "published",
		});
	});

	it("returns an organizer-owned draft event when the requester owns it", async () => {
		const { db } = createMockSlugStore([[buildEventRow()], [organizerRow]]);

		const result = await getEvent(db, EVENT_ID, TEST_USER_ID);

		expect(result).toMatchObject({
			id: EVENT_ID,
			organizerId: TEST_ORGANIZER_ID,
			status: "draft",
		});
	});

	it("does not expose draft events without organizer ownership", async () => {
		const { db } = createMockSlugStore([[buildEventRow()]]);

		await expect(getEvent(db, EVENT_ID)).rejects.toThrow(NotFoundError);
	});

	it("returns 404 for a missing event", async () => {
		const { db } = createMockSlugStore([[]]);

		await expect(getEvent(db, EVENT_ID)).rejects.toThrow(NotFoundError);
	});
});

describe("event category service", () => {
	it("lists categories for an existing event ordered by sort order", async () => {
		const categoryRows = [
			buildEventCategoryRow(),
			buildEventCategoryRow({
				id: CATEGORY_10K_ID,
				name: "10K",
				slug: "10k",
				distanceMeters: 10_000,
				sortOrder: 1,
			}),
		];
		const { db } = createMockSlugStore([
			[buildEventRow({ status: "published" })],
			categoryRows,
		]);

		const result = await listEventCategories(db, EVENT_ID);

		expect(result.map((category) => category.slug)).toEqual(["5k", "10k"]);
		expect(result[0]).toMatchObject({
			id: CATEGORY_5K_ID,
			eventId: EVENT_ID,
			name: "5K",
			distanceMeters: 5_000,
			sortOrder: 0,
		});
	});

	it("allows an organizer to list categories for their own non-public event", async () => {
		const categoryRows = [buildEventCategoryRow()];
		const { db } = createMockSlugStore([
			[
				buildEventRow({
					status: "under_review",
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			[organizerRow],
			categoryRows,
		]);

		const result = await listEventCategories(db, EVENT_ID, TEST_USER_ID);

		expect(result).toHaveLength(1);
		expect(result[0]?.slug).toBe("5k");
	});

	it("does not expose draft categories without organizer ownership", async () => {
		const { db } = createMockSlugStore([[buildEventRow()]]);

		await expect(listEventCategories(db, EVENT_ID)).rejects.toThrow(
			NotFoundError,
		);
	});

	it("returns 404 when listing categories for a missing event", async () => {
		const { db } = createMockSlugStore([[]]);

		await expect(listEventCategories(db, EVENT_ID)).rejects.toThrow(
			NotFoundError,
		);
	});

	it("replaces all categories atomically for an organizer-owned draft event", async () => {
		const categoryRows = [
			buildEventCategoryRow(),
			buildEventCategoryRow({
				id: CATEGORY_10K_ID,
				name: "10K",
				slug: "10k",
				distanceMeters: 10_000,
				sortOrder: 1,
			}),
		];
		const { db, deleteFn, insertValues, selectQueries, transaction } =
			createMockSlugStore([
				[organizerRow],
				[buildEventRow()],
				[],
				categoryRows,
			]);
		const log = { info: vi.fn() };

		const result = await replaceEventCategories(
			{ db, log },
			TEST_USER_ID,
			EVENT_ID,
			validEventCategoriesInput,
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(selectQueries[1]?.for).toHaveBeenCalledWith("update");
		expect(deleteFn).toHaveBeenCalledWith(eventCategories);
		expect(insertValues).toHaveBeenCalledWith([
			{
				eventId: EVENT_ID,
				name: "5K",
				slug: "5k",
				distanceMeters: 5_000,
				sortOrder: 0,
			},
			{
				eventId: EVENT_ID,
				name: "10K",
				slug: "10k",
				distanceMeters: 10_000,
				sortOrder: 1,
			},
		]);
		expect(result.map((category) => category.slug)).toEqual(["5k", "10k"]);
		expect(log.info).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				organizerId: TEST_ORGANIZER_ID,
				userId: TEST_USER_ID,
				categoryCount: 2,
			}),
			"Event categories replaced",
		);
	});

	it("returns 409 instead of silently deleting pricing when replacing priced categories", async () => {
		const { db, deleteFn, insert } = createMockSlugStore([
			[organizerRow],
			[buildEventRow()],
			[buildEventPricingTierRow()],
		]);

		await expect(
			replaceEventCategories(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validEventCategoriesInput,
			),
		).rejects.toThrow(ConflictError);
		expect(deleteFn).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("returns 404 when replacing categories without an organizer profile", async () => {
		const { db, deleteFn, insert } = createMockSlugStore([[]]);

		await expect(
			replaceEventCategories(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validEventCategoriesInput,
			),
		).rejects.toThrow(NotFoundError);
		expect(deleteFn).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("returns 403 when replacing categories for another organizer's event", async () => {
		const { db, deleteFn, insert } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ organizerId: OTHER_ORGANIZER_ID })],
		]);

		await expect(
			replaceEventCategories(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validEventCategoriesInput,
			),
		).rejects.toThrow(ForbiddenError);
		expect(deleteFn).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("returns 409 when replacing categories for a non-draft event", async () => {
		const { db, deleteFn, insert } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ status: "published" })],
		]);

		await expect(
			replaceEventCategories(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validEventCategoriesInput,
			),
		).rejects.toThrow(ConflictError);
		expect(deleteFn).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it.each([
		[
			"empty category array",
			{
				categories: [],
			},
		],
		[
			"duplicate slugs",
			{
				categories: [
					{
						name: "5K",
						slug: "5k",
						distanceMeters: 5_000,
						sortOrder: 0,
					},
					{
						name: "Five Kilometres",
						slug: "5k",
						distanceMeters: 5_000,
						sortOrder: 1,
					},
				],
			},
		],
		[
			"invalid distance",
			{
				categories: [
					{
						name: "5K",
						slug: "5k",
						distanceMeters: 0,
						sortOrder: 0,
					},
				],
			},
		],
	])("rejects %s before touching the database", async (_name, input) => {
		const { db, select, insert } = createMockSlugStore();

		await expect(
			replaceEventCategories(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				input,
			),
		).rejects.toThrow(ValidationError);
		expect(select).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});
});

describe("event policy service", () => {
	it("returns nullable policies for a draft event without saved policy text", async () => {
		const { db } = createMockSlugStore([
			[buildEventRow({ status: "published" })],
			[buildEventRow({ status: "published" })],
		]);

		const result = await getEventPolicies(db, EVENT_ID);

		expect(result).toEqual({
			eventId: EVENT_ID,
			refundPolicy: null,
			cancellationPolicy: null,
			updatedAt: "2026-04-26T12:00:00.000Z",
		});
	});

	it("updates policies atomically for an organizer-owned draft event", async () => {
		const updatedAt = new Date("2026-04-27T12:00:00.000Z");
		const { db, selectQueries, transaction, updateSet } = createMockSlugStore(
			[[organizerRow], [buildEventRow()]],
			[
				buildEventRow({
					...validEventPoliciesInput,
					updatedAt,
				}),
			],
		);
		const log = { info: vi.fn() };

		const result = await updateEventPolicies(
			{ db, log },
			TEST_USER_ID,
			EVENT_ID,
			validEventPoliciesInput,
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(selectQueries[1]?.for).toHaveBeenCalledWith("update");
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining(validEventPoliciesInput),
		);
		expect(result).toEqual({
			eventId: EVENT_ID,
			...validEventPoliciesInput,
			updatedAt: "2026-04-27T12:00:00.000Z",
		});
		expect(log.info).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				organizerId: TEST_ORGANIZER_ID,
				userId: TEST_USER_ID,
			}),
			"Event policies updated",
		);
	});

	it("does not expose draft policies without organizer ownership", async () => {
		const { db } = createMockSlugStore([[buildEventRow()]]);

		await expect(getEventPolicies(db, EVENT_ID)).rejects.toThrow(NotFoundError);
	});

	it("trims policy text before updating", async () => {
		const { db, updateSet } = createMockSlugStore(
			[[organizerRow], [buildEventRow()]],
			[
				buildEventRow({
					...validEventPoliciesInput,
				}),
			],
		);

		await updateEventPolicies(
			{ db, log: { info: vi.fn() } },
			TEST_USER_ID,
			EVENT_ID,
			{
				refundPolicy: `  ${validEventPoliciesInput.refundPolicy}  `,
				cancellationPolicy: `  ${validEventPoliciesInput.cancellationPolicy}  `,
			},
		);

		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining(validEventPoliciesInput),
		);
	});

	it("returns 403 when updating policies for another organizer's event", async () => {
		const { db, update } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ organizerId: OTHER_ORGANIZER_ID })],
		]);

		await expect(
			updateEventPolicies(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validEventPoliciesInput,
			),
		).rejects.toThrow(ForbiddenError);
		expect(update).not.toHaveBeenCalled();
	});

	it("allows policy updates on a published event and writes an audit row", async () => {
		const publishedEvent = buildEventRow({ status: "published" });
		const { db, update } = createMockSlugStore(
			[[organizerRow], [publishedEvent]],
			[publishedEvent],
		);
		const auditLog = vi.fn().mockResolvedValue(undefined);

		await expect(
			updateEventPolicies(
				{
					db,
					log: { info: vi.fn() },
					auditLogger: {
						log: auditLog,
						logBatch: vi.fn().mockResolvedValue(undefined),
					},
				},
				TEST_USER_ID,
				EVENT_ID,
				validEventPoliciesInput,
			),
		).resolves.toBeDefined();
		expect(update).toHaveBeenCalled();
		expect(auditLog).toHaveBeenCalledTimes(1);
	});

	it("rejects invalid policies before touching the database", async () => {
		const { db, select, update } = createMockSlugStore();

		await expect(
			updateEventPolicies(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				{
					refundPolicy: "",
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				},
			),
		).rejects.toThrow(ValidationError);
		expect(select).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});
});

describe("event registration form service", () => {
	it("returns the default registration form for an organizer-owned event", async () => {
		const { db } = createMockSlugStore([
			[organizerRow],
			[
				buildEventRow({
					formSchema: defaultEventRegistrationFormSchema,
					formSchemaVersion: defaultEventRegistrationFormSchema.version,
				}),
			],
		]);

		const result = await getEventRegistrationForm(db, TEST_USER_ID, EVENT_ID);

		expect(result).toEqual({
			eventId: EVENT_ID,
			formSchema: defaultEventRegistrationFormSchema,
			formSchemaVersion: defaultEventRegistrationFormSchema.version,
			updatedAt: "2026-04-26T12:00:00.000Z",
		});
	});

	it("updates the registration form atomically for an organizer-owned draft event", async () => {
		const updatedAt = new Date("2026-04-27T12:00:00.000Z");
		const { db, selectQueries, transaction, updateSet } = createMockSlugStore(
			[[organizerRow], [buildEventRow()]],
			[
				buildEventRow({
					formSchema: validRegistrationFormInput,
					formSchemaVersion: validRegistrationFormInput.version,
					updatedAt,
				}),
			],
		);
		const log = { info: vi.fn() };

		const result = await updateEventRegistrationForm(
			{ db, log },
			TEST_USER_ID,
			EVENT_ID,
			validRegistrationFormInput,
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(selectQueries[1]?.for).toHaveBeenCalledWith("update");
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				formSchema: validRegistrationFormInput,
				formSchemaVersion: validRegistrationFormInput.version,
				updatedAt: expect.any(Date),
			}),
		);
		expect(result).toEqual({
			eventId: EVENT_ID,
			formSchema: validRegistrationFormInput,
			formSchemaVersion: validRegistrationFormInput.version,
			updatedAt: "2026-04-27T12:00:00.000Z",
		});
		expect(log.info).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				organizerId: TEST_ORGANIZER_ID,
				userId: TEST_USER_ID,
				formSchemaVersion: validRegistrationFormInput.version,
			}),
			"Event registration form updated",
		);
	});

	it("rejects sensitive required fields without a safety-critical reason before touching the database", async () => {
		const { db, select, update } = createMockSlugStore();
		const invalidInput = {
			...defaultEventRegistrationFormSchema,
			fields: defaultEventRegistrationFormSchema.fields.map((field) =>
				field.fieldId === "date_of_birth"
					? { ...field, enabled: true, required: true }
					: field,
			),
		};

		await expect(
			updateEventRegistrationForm(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				invalidInput,
			),
		).rejects.toThrow(ValidationError);
		expect(select).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("returns 403 when updating another organizer's registration form", async () => {
		const { db, update } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ organizerId: OTHER_ORGANIZER_ID })],
		]);

		await expect(
			updateEventRegistrationForm(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validRegistrationFormInput,
			),
		).rejects.toThrow(ForbiddenError);
		expect(update).not.toHaveBeenCalled();
	});

	it("returns 409 when updating a published event registration form", async () => {
		const { db, update } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ status: "published" })],
		]);

		await expect(
			updateEventRegistrationForm(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validRegistrationFormInput,
			),
		).rejects.toThrow(ConflictError);
		expect(update).not.toHaveBeenCalled();
	});
});

describe("event publish state machine", () => {
	const categoryRows = [buildEventCategoryRow()];
	const pricingRows = [buildEventPricingTierRow()];

	it("rejects unpublishing a never-published draft instead of treating it as idempotent", async () => {
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status: "draft",
					publishedAt: null,
					submittedForReviewAt: null,
				}),
			],
		]);

		await expect(
			unpublishEvent(createPublishDeps(db), TEST_USER_ID, EVENT_ID),
		).rejects.toMatchObject({
			code: "EVENT_NOT_UNPUBLISHABLE",
			statusCode: 400,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it("publishes a ready draft event directly and records publish-request plus publish audit entries", async () => {
		const publishedAt = new Date("2026-04-26T12:15:00.000Z");
		const auditLogger = createAuditLogger();
		const { db, transaction, updateSet } = createMockSlugStore(
			[
				[verifiedOrganizerRow],
				[
					buildEventRow({
						status: "draft",
						refundPolicy: validEventPoliciesInput.refundPolicy,
						cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
					}),
				],
				categoryRows,
				pricingRows,
				[buildHeroImageRow()],
				[],
				[],
			],
			[
				buildEventRow({
					status: "published",
					publishedAt,
					submittedForReviewAt: null,
				}),
			],
		);

		const result = await publishEvent(
			createPublishDeps(db, auditLogger),
			TEST_USER_ID,
			EVENT_ID,
			"127.0.0.1",
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "published",
				publishedAt: expect.any(Date),
				submittedForReviewAt: null,
				updatedAt: expect.any(Date),
			}),
		);
		expect(result).toMatchObject({
			transition: "draft_to_published",
			event: {
				status: "published",
				publishedAt: "2026-04-26T12:15:00.000Z",
			},
			readiness: {
				ready: true,
				wouldRequireAdminReview: false,
			},
		});
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.publish_requested",
				actorRole: "organizer",
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					from: "draft",
				},
			}),
		);
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.publish",
				actorRole: "organizer",
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					transition: "draft_to_published",
				},
			}),
		);
	});

	it("submits a ready paid draft for review when the admin-review policy requires it", async () => {
		const submittedForReviewAt = new Date("2026-04-26T12:18:00.000Z");
		const auditLogger = createAuditLogger();
		const requiresAdminReview = vi.fn().mockResolvedValue(true);
		const { db, updateSet } = createMockSlugStore(
			[
				[verifiedOrganizerRow],
				[
					buildEventRow({
						status: "draft",
						refundPolicy: validEventPoliciesInput.refundPolicy,
						cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
					}),
				],
				categoryRows,
				pricingRows,
				[buildHeroImageRow()],
				[],
				[],
			],
			[
				buildEventRow({
					status: "under_review",
					publishedAt: null,
					submittedForReviewAt,
				}),
			],
		);

		const result = await publishEvent(
			{
				...createPublishDeps(db, auditLogger),
				requiresAdminReview,
			},
			TEST_USER_ID,
			EVENT_ID,
		);

		expect(requiresAdminReview).toHaveBeenCalledWith(TEST_ORGANIZER_ID);
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "under_review",
				publishedAt: null,
				submittedForReviewAt: expect.any(Date),
			}),
		);
		expect(result).toMatchObject({
			transition: "draft_to_under_review",
			event: {
				status: "under_review",
				submittedForReviewAt: "2026-04-26T12:18:00.000Z",
			},
			readiness: {
				ready: true,
				wouldRequireAdminReview: true,
			},
		});
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.submit_for_review",
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					transition: "draft_to_under_review",
				},
			}),
		);
	});

	it("returns a same-owner no-op when publishing an already published event", async () => {
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status: "published",
					publishedAt: new Date("2026-04-26T12:00:00.000Z"),
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			categoryRows,
			pricingRows,
			[buildHeroImageRow()],
			[],
			[],
		]);

		const result = await publishEvent(
			createPublishDeps(db),
			TEST_USER_ID,
			EVENT_ID,
		);

		expect(result.transition).toBe("noop_already_published");
		expect(result.event.status).toBe("published");
		expect(update).not.toHaveBeenCalled();
	});

	it("returns a same-owner no-op when publishing an event already under review", async () => {
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status: "under_review",
					submittedForReviewAt: new Date("2026-04-26T12:00:00.000Z"),
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			categoryRows,
			pricingRows,
			[buildHeroImageRow()],
			[],
			[],
		]);

		const result = await publishEvent(
			createPublishDeps(db),
			TEST_USER_ID,
			EVENT_ID,
		);

		expect(result.transition).toBe("noop_already_under_review");
		expect(result.event.status).toBe("under_review");
		expect(update).not.toHaveBeenCalled();
	});

	it.each([
		"completed",
		"cancelled",
	] as const)("rejects publish attempts for %s events", async (status) => {
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status,
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			categoryRows,
			pricingRows,
			[buildHeroImageRow()],
			[],
			[],
		]);

		await expect(
			publishEvent(createPublishDeps(db), TEST_USER_ID, EVENT_ID),
		).rejects.toThrow(ConflictError);
		expect(update).not.toHaveBeenCalled();
	});

	it("does not write a transition audit when a concurrent publish wins first", async () => {
		const auditLogger = createAuditLogger();
		const { db } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status: "draft",
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			categoryRows,
			pricingRows,
			[buildHeroImageRow()],
			[],
			[],
		]);

		await expect(
			publishEvent(createPublishDeps(db, auditLogger), TEST_USER_ID, EVENT_ID),
		).rejects.toThrow(ConflictError);

		const auditActions = vi
			.mocked(auditLogger.log)
			.mock.calls.map(([entry]) => entry.action);
		expect(auditActions).toEqual(["event.publish_requested"]);
		expect(auditActions).not.toContain("event.publish");
		expect(auditActions).not.toContain("event.submit_for_review");
	});

	it("rejects publish attempts for events owned by a different organizer", async () => {
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[buildEventRow({ organizerId: OTHER_ORGANIZER_ID })],
		]);

		await expect(
			publishEvent(createPublishDeps(db), TEST_USER_ID, EVENT_ID),
		).rejects.toThrow(ForbiddenError);
		expect(update).not.toHaveBeenCalled();
	});

	it("unpublishes a published event and records safe audit metadata", async () => {
		const publishedAt = new Date("2026-04-26T12:05:00.000Z");
		const updatedAt = new Date("2026-04-26T12:10:00.000Z");
		const auditLogger = createAuditLogger();
		const { db, transaction, updateSet } = createMockSlugStore(
			[
				[verifiedOrganizerRow],
				[
					buildEventRow({
						status: "published",
						publishedAt,
					}),
				],
			],
			[
				buildEventRow({
					status: "draft",
					publishedAt: null,
					updatedAt,
				}),
			],
		);

		const result = await unpublishEvent(
			createPublishDeps(db, auditLogger),
			TEST_USER_ID,
			EVENT_ID,
			"127.0.0.1",
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "draft",
				publishedAt: null,
				updatedAt: expect.any(Date),
			}),
		);
		expect(result).toMatchObject({
			transition: "published_to_draft",
			event: {
				id: EVENT_ID,
				status: "draft",
				publishedAt: null,
			},
		});
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.unpublish",
				actorRole: "organizer",
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					transition: "published_to_draft",
				},
			}),
		);
	});

	it("keeps firstPublishedAt when unpublishing one of the first three paid events and sends the next paid event to review", async () => {
		const firstPublishedAt = new Date("2026-04-20T09:00:00.000Z");
		const { db: unpublishDb, updateSet: unpublishUpdateSet } =
			createMockSlugStore(
				[
					[verifiedOrganizerRow],
					[
						buildEventRow({
							status: "published",
							publishedAt: new Date("2026-04-26T12:05:00.000Z"),
							firstPublishedAt,
						}),
					],
				],
				[
					buildEventRow({
						status: "draft",
						publishedAt: null,
						firstPublishedAt,
					}),
				],
			);

		const unpublished = await unpublishEvent(
			createPublishDeps(unpublishDb),
			TEST_USER_ID,
			EVENT_ID,
		);

		expect(unpublished.event.firstPublishedAt).toBe(
			firstPublishedAt.toISOString(),
		);
		expect(unpublishUpdateSet).toHaveBeenCalledWith(
			expect.not.objectContaining({ firstPublishedAt: expect.anything() }),
		);

		const { db: countDb } = createMockSlugStore([[{ total: 3 }]]);
		await expect(
			getPublishedPaidEventCount(asDatabase(countDb), TEST_ORGANIZER_ID),
		).resolves.toBe(3);
		await expect(
			requiresAdminReview(
				asDatabase(createMockSlugStore([[{ total: 3 }]]).db),
				TEST_ORGANIZER_ID,
			),
		).resolves.toBe(true);

		const requiresAdminReviewSpy = vi.fn().mockResolvedValue(true);
		const submittedForReviewAt = new Date("2026-04-27T12:18:00.000Z");
		const { db: publishDb } = createMockSlugStore(
			[
				[verifiedOrganizerRow],
				[
					buildEventRow({
						id: "99999999-9999-4999-8999-999999999999",
						status: "draft",
						refundPolicy: validEventPoliciesInput.refundPolicy,
						cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
					}),
				],
				categoryRows,
				pricingRows,
				[buildHeroImageRow()],
				[],
				[],
			],
			[
				buildEventRow({
					id: "99999999-9999-4999-8999-999999999999",
					status: "under_review",
					publishedAt: null,
					submittedForReviewAt,
				}),
			],
		);

		const result = await publishEvent(
			{
				...createPublishDeps(publishDb),
				requiresAdminReview: requiresAdminReviewSpy,
			},
			TEST_USER_ID,
			"99999999-9999-4999-8999-999999999999",
		);

		expect(result.readiness.wouldRequireAdminReview).toBe(true);
		expect(result.transition).toBe("draft_to_under_review");
		expect(result.event.status).toBe("under_review");
	});

	it("blocks publishing when categories and dependent pricing are missing", async () => {
		const auditLogger = createAuditLogger();
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status: "draft",
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			[],
			[],
			[buildHeroImageRow()],
			[],
			[],
		]);

		await expect(
			publishEvent(createPublishDeps(db, auditLogger), TEST_USER_ID, EVENT_ID),
		).rejects.toMatchObject({
			code: "EVENT_PRICING_INACTIVE",
			statusCode: 400,
		});
		expect(update).not.toHaveBeenCalled();
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.publish_denied",
				metadata: expect.objectContaining({
					denialCodes: expect.arrayContaining([
						"categories_configured",
						"pricing_configured",
						"active_pricing",
					]),
				}),
			}),
		);
	});

	it("blocks publishing when configured categories have no active pricing tiers", async () => {
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status: "draft",
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			categoryRows,
			[],
			[buildHeroImageRow()],
			[],
			[],
		]);

		await expect(
			publishEvent(createPublishDeps(db), TEST_USER_ID, EVENT_ID),
		).rejects.toMatchObject({
			code: "EVENT_PRICING_INACTIVE",
			statusCode: 400,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it("blocks publishing when the event start date is no longer in the future", async () => {
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status: "draft",
					startAt: new Date("2020-01-01T00:00:00.000Z"),
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			categoryRows,
			pricingRows,
			[buildHeroImageRow()],
			[],
			[],
		]);

		await expect(
			publishEvent(createPublishDeps(db), TEST_USER_ID, EVENT_ID),
		).rejects.toMatchObject({
			code: "EVENT_DATE_IN_PAST",
			statusCode: 400,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it("blocks publishing when a stale slug conflict is detected", async () => {
		const { db, update } = createMockSlugStore([
			[verifiedOrganizerRow],
			[
				buildEventRow({
					status: "draft",
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			categoryRows,
			pricingRows,
			[buildHeroImageRow()],
			[{ id: "99999999-9999-4999-8999-999999999999" }],
			[],
		]);

		await expect(
			publishEvent(createPublishDeps(db), TEST_USER_ID, EVENT_ID),
		).rejects.toMatchObject({
			code: "EVENT_SLUG_CONFLICT",
			statusCode: 409,
		});
		expect(update).not.toHaveBeenCalled();
	});

	it("audits denied publish attempts with denial codes only", async () => {
		const auditLogger = createAuditLogger();
		const { db, update } = createMockSlugStore([
			[organizerRow],
			[
				buildEventRow({
					status: "draft",
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			categoryRows,
			pricingRows,
			[buildHeroImageRow()],
			[],
			[],
		]);

		await expect(
			publishEvent(
				createPublishDeps(db, auditLogger),
				TEST_USER_ID,
				EVENT_ID,
				"127.0.0.1",
			),
		).rejects.toMatchObject({
			code: "ORGANIZER_NOT_VERIFIED",
			statusCode: 403,
		});

		expect(update).not.toHaveBeenCalled();
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.publish_denied",
				actorRole: "organizer",
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					denialCodes: ["organizer_verified", "razorpay_linked"],
				},
			}),
		);
	});

	it("admin approval re-checks real organizer readiness and blocks stale Razorpay failures", async () => {
		const auditLogger = createAuditLogger();
		const { db, update } = createMockSlugStore([
			[
				buildEventRow({
					status: "under_review",
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			[
				{
					id: TEST_ORGANIZER_ID,
					isVerified: true,
					razorpayAccountStatus: "not_started",
				},
			],
			categoryRows,
			pricingRows,
			[buildHeroImageRow()],
			[],
			[],
		]);

		await expect(
			adminApproveEvent(
				createPublishDeps(db, auditLogger),
				EVENT_ID,
				"99999999-9999-4999-8999-999999999999",
				"127.0.0.1",
			),
		).rejects.toMatchObject({
			code: "RAZORPAY_NOT_LINKED",
			statusCode: 403,
		});

		expect(update).not.toHaveBeenCalled();
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.publish_denied",
				actorRole: "admin",
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					source: "admin_review",
					denialCodes: ["razorpay_linked"],
				},
			}),
		);
	});

	it("admin approval re-checks completeness before publishing under-review events", async () => {
		const auditLogger = createAuditLogger();
		const { db, update } = createMockSlugStore([
			[
				buildEventRow({
					status: "under_review",
					refundPolicy: validEventPoliciesInput.refundPolicy,
					cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
				}),
			],
			[
				{
					id: TEST_ORGANIZER_ID,
					isVerified: true,
					razorpayAccountStatus: "active",
				},
			],
			categoryRows,
			pricingRows,
			[],
			[],
			[],
		]);

		await expect(
			adminApproveEvent(
				createPublishDeps(db, auditLogger),
				EVENT_ID,
				"99999999-9999-4999-8999-999999999999",
			),
		).rejects.toMatchObject({
			code: "EVENT_INCOMPLETE",
			statusCode: 400,
		});

		expect(update).not.toHaveBeenCalled();
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.publish_denied",
				actorRole: "admin",
				metadata: expect.objectContaining({
					source: "admin_review",
					denialCodes: ["hero_image_uploaded"],
				}),
			}),
		);
	});

	it("admin approval publishes only after current real readiness passes", async () => {
		const publishedAt = new Date("2026-04-26T12:20:00.000Z");
		const auditLogger = createAuditLogger();
		const { db, transaction, updateSet } = createMockSlugStore(
			[
				[
					buildEventRow({
						status: "under_review",
						refundPolicy: validEventPoliciesInput.refundPolicy,
						cancellationPolicy: validEventPoliciesInput.cancellationPolicy,
					}),
				],
				[
					{
						id: TEST_ORGANIZER_ID,
						isVerified: true,
						razorpayAccountStatus: "active",
					},
				],
				categoryRows,
				pricingRows,
				[buildHeroImageRow()],
				[],
				[],
			],
			[
				buildEventRow({
					status: "published",
					publishedAt,
				}),
			],
		);

		const result = await adminApproveEvent(
			createPublishDeps(db, auditLogger),
			EVENT_ID,
			"99999999-9999-4999-8999-999999999999",
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "published",
				publishedAt: expect.any(Date),
				updatedAt: expect.any(Date),
			}),
		);
		expect(result).toMatchObject({
			transition: "under_review_to_published",
			event: {
				status: "published",
				publishedAt: "2026-04-26T12:20:00.000Z",
			},
			readiness: {
				ready: true,
				items: expect.arrayContaining([
					expect.objectContaining({
						check: "organizer_verified",
						passed: true,
					}),
					expect.objectContaining({
						check: "razorpay_linked",
						passed: true,
					}),
				]),
			},
		});
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.publish",
				actorRole: "admin",
				metadata: {
					organizerId: TEST_ORGANIZER_ID,
					source: "admin_review",
					transition: "under_review_to_published",
				},
			}),
		);
	});

	it("admin rejection returns an under-review event to draft and audits the review transition", async () => {
		const auditLogger = createAuditLogger();
		const { db, updateSet } = createMockSlugStore(
			[[buildEventRow({ status: "under_review" })], [organizerRow]],
			[
				buildEventRow({
					status: "draft",
					publishedAt: null,
				}),
			],
		);

		const result = await adminRejectEvent(
			createPublishDeps(db, auditLogger),
			EVENT_ID,
			"99999999-9999-4999-8999-999999999999",
			"Not ready",
		);

		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "draft",
				publishedAt: null,
				updatedAt: expect.any(Date),
			}),
		);
		expect(result.transition).toBe("under_review_to_draft");
		expect(auditLogger.log).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event.publish_rejected",
				actorRole: "admin",
				metadata: expect.objectContaining({
					organizerId: TEST_ORGANIZER_ID,
					reason: "Not ready",
					source: "admin_review",
					transition: "under_review_to_draft",
				}),
			}),
		);
	});
});

describe("event pricing service", () => {
	const categoryRows = [
		buildEventCategoryRow(),
		buildEventCategoryRow({
			id: CATEGORY_10K_ID,
			name: "10K",
			slug: "10k",
			distanceMeters: 10_000,
			sortOrder: 1,
		}),
	];
	const pricingRows = [
		buildEventPricingTierRow(),
		buildEventPricingTierRow({
			id: PRICING_10K_ID,
			eventCategoryId: CATEGORY_10K_ID,
			basePrice: 1499,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
		}),
	];

	it("lists pricing tiers with their categories ordered by category sort order", async () => {
		const { db } = createMockSlugStore([
			[buildEventRow({ status: "published" })],
			categoryRows,
			pricingRows,
		]);

		const result = await listEventPricing(db, EVENT_ID);

		expect(result.map((tier) => tier.category.slug)).toEqual(["5k", "10k"]);
		expect(result[0]).toMatchObject({
			id: PRICING_5K_ID,
			eventId: EVENT_ID,
			eventCategoryId: CATEGORY_5K_ID,
			basePrice: 999,
			earlyBirdPrice: 799,
			earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
		});
	});

	it("does not expose draft pricing without organizer ownership", async () => {
		const { db } = createMockSlugStore([[buildEventRow()]]);

		await expect(listEventPricing(db, EVENT_ID)).rejects.toThrow(NotFoundError);
	});

	it("replaces pricing tiers atomically for an organizer-owned draft event", async () => {
		const { db, deleteFn, insertValues, selectQueries, transaction } =
			createMockSlugStore([
				[organizerRow],
				[buildEventRow()],
				categoryRows,
				pricingRows,
			]);
		const log = { info: vi.fn() };

		const result = await replaceEventPricing(
			{ db, log },
			TEST_USER_ID,
			EVENT_ID,
			validEventPricingInput,
		);

		expect(transaction).toHaveBeenCalledOnce();
		expect(selectQueries[1]?.for).toHaveBeenCalledWith("update");
		expect(deleteFn).toHaveBeenCalledWith(eventPricingTiers);
		expect(insertValues).toHaveBeenCalledWith([
			{
				eventId: EVENT_ID,
				eventCategoryId: CATEGORY_5K_ID,
				basePrice: 999,
				earlyBirdPrice: 799,
				earlyBirdDeadline: new Date("2026-07-01T03:30:00.000Z"),
			},
			{
				eventId: EVENT_ID,
				eventCategoryId: CATEGORY_10K_ID,
				basePrice: 1499,
				earlyBirdPrice: null,
				earlyBirdDeadline: null,
			},
		]);
		expect(result.map((tier) => tier.category.slug)).toEqual(["5k", "10k"]);
		expect(log.info).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: EVENT_ID,
				organizerId: TEST_ORGANIZER_ID,
				userId: TEST_USER_ID,
				tierCount: 2,
			}),
			"Event pricing replaced",
		);
	});

	it("returns the early-bird price when the timestamp is before the deadline", async () => {
		const { db } = createMockSlugStore([
			[buildEventRow()],
			[buildEventCategoryRow()],
			[buildEventPricingTierRow()],
		]);

		const result = await getApplicableEventPrice(
			db,
			EVENT_ID,
			CATEGORY_5K_ID,
			new Date("2026-06-15T03:30:00.000Z"),
		);

		expect(result).toEqual({
			eventId: EVENT_ID,
			eventCategoryId: CATEGORY_5K_ID,
			price: 799,
			basePrice: 999,
			earlyBirdPrice: 799,
			earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
			isEarlyBird: true,
			asOf: "2026-06-15T03:30:00.000Z",
		});
	});

	it("returns the base price after the early-bird deadline", async () => {
		const { db } = createMockSlugStore([
			[buildEventRow()],
			[buildEventCategoryRow()],
			[buildEventPricingTierRow()],
		]);

		const result = await getApplicableEventPrice(
			db,
			EVENT_ID,
			CATEGORY_5K_ID,
			new Date("2026-07-02T03:30:00.000Z"),
		);

		expect(result.price).toBe(999);
		expect(result.isEarlyBird).toBe(false);
	});

	it("rejects applicable price lookup when the category is not part of the event", async () => {
		const { db } = createMockSlugStore([[buildEventRow()], []]);

		await expect(
			getApplicableEventPrice(
				db,
				EVENT_ID,
				CATEGORY_5K_ID,
				new Date("2026-06-15T03:30:00.000Z"),
			),
		).rejects.toThrow(ValidationError);
	});

	it("rejects applicable price lookup when no pricing tier exists", async () => {
		const { db } = createMockSlugStore([
			[buildEventRow()],
			[buildEventCategoryRow()],
			[],
		]);

		await expect(
			getApplicableEventPrice(
				db,
				EVENT_ID,
				CATEGORY_5K_ID,
				new Date("2026-06-15T03:30:00.000Z"),
			),
		).rejects.toThrow(NotFoundError);
	});

	it("returns 403 when replacing pricing for another organizer's event", async () => {
		const { db, deleteFn, insert } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ organizerId: OTHER_ORGANIZER_ID })],
		]);

		await expect(
			replaceEventPricing(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validEventPricingInput,
			),
		).rejects.toThrow(ForbiddenError);
		expect(deleteFn).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("returns 409 when replacing pricing for a published event", async () => {
		const { db, deleteFn, insert } = createMockSlugStore([
			[organizerRow],
			[buildEventRow({ status: "published" })],
		]);

		await expect(
			replaceEventPricing(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validEventPricingInput,
			),
		).rejects.toThrow(ConflictError);
		expect(deleteFn).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("returns 409 when pricing categories are not configured", async () => {
		const { db, deleteFn, insert } = createMockSlugStore([
			[organizerRow],
			[buildEventRow()],
			[],
		]);

		await expect(
			replaceEventPricing(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				validEventPricingInput,
			),
		).rejects.toThrow(ConflictError);
		expect(deleteFn).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("rejects pricing that does not cover every event category", async () => {
		const { db, deleteFn, insert } = createMockSlugStore([
			[organizerRow],
			[buildEventRow()],
			categoryRows,
		]);

		await expect(
			replaceEventPricing(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				{
					tiers: [
						{
							eventCategoryId: CATEGORY_5K_ID,
							basePrice: 999,
						},
					],
				},
			),
		).rejects.toThrow(ValidationError);
		expect(deleteFn).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});

	it("rejects invalid pricing before touching the database", async () => {
		const { db, select, insert } = createMockSlugStore();

		await expect(
			replaceEventPricing(
				{ db, log: { info: vi.fn() } },
				TEST_USER_ID,
				EVENT_ID,
				{
					tiers: [
						{
							eventCategoryId: CATEGORY_5K_ID,
							basePrice: 999,
							earlyBirdPrice: 999,
							earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
						},
					],
				},
			),
		).rejects.toThrow(ValidationError);
		expect(select).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});
});
