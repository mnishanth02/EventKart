import { and, type Database, eq, inArray, ne, sql } from "@repo/db";
import {
	eventCategories,
	eventImages,
	eventPricingTiers,
	events,
	organizers,
	slugRedirects,
} from "@repo/db/schema";
import { AUDIT_ACTIONS, DEFAULT_EVENT_STATUS } from "@repo/shared/constants";
import type {
	Event,
	EventCategoryRecord,
	EventPoliciesConfig,
	EventPoliciesRecord,
	EventPricingConfig,
	EventPricingTierWithCategory,
	EventRegistrationForm,
	EventPublishTransition,
	EventSlug,
	PublishReadiness,
	PublishReadinessCheck,
	PublishReadinessItem,
	UpdateEvent,
} from "@repo/shared/schemas";
import {
	createEventInputSchema,
	eventCategoriesConfigSchema,
	eventCategoryRecordSchema,
	eventPoliciesConfigSchema,
	eventPoliciesRecordSchema,
	eventPricingConfigSchema,
	eventPricingTierWithCategorySchema,
	eventRegistrationFormSchema,
	eventSchema,
	eventSlugSchema,
	defaultEventRegistrationFormSchema,
	updateEventInputSchema,
	uuidSchema,
} from "@repo/shared/schemas";
import { appendEventSlugSuffix, normalizeEventSlug } from "@repo/shared/utils";
import type { FastifyBaseLogger } from "fastify";
import type { AuditLogger } from "../../lib/audit.js";
import {
	AppError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../lib/errors.js";
import { getOrganizerByUserId } from "../organizer/service.js";

export const EVENT_SLUG_RESOURCE_TYPE = "event";
export const DEFAULT_EVENT_SLUG_MAX_ATTEMPTS = 50;

export type EventSlugStore = Pick<
	Database,
	"delete" | "insert" | "select" | "update"
>;

export interface EventSlugTransactionalStore extends EventSlugStore {
	transaction: Database["transaction"];
}

export interface ReserveEventSlugOptions {
	excludeEventId?: string;
	maxAttempts?: number;
}

export interface EventSlugRedirectInput {
	eventId: string;
	oldSlug: string;
	newSlug: string;
}

export interface EventSlugRedirectResult {
	recorded: boolean;
}

export interface UpdateEventSlugInput {
	eventId: string;
	slugCandidate: string;
	currentSlug?: string;
}

export interface UpdateEventSlugResult {
	changed: boolean;
	previousSlug: EventSlug;
	slug: EventSlug;
}

export interface CreateDraftEventDeps {
	db: Database;
	log: Pick<FastifyBaseLogger, "info">;
}

export interface UpdateDraftEventDeps {
	db: Database;
	log: Pick<FastifyBaseLogger, "info">;
}

export interface EventPublishDeps {
	db: Database;
	log: Pick<FastifyBaseLogger, "info">;
	auditLogger: AuditLogger;
	requiresAdminReview?: (organizerId: string) => Promise<boolean>;
}

type EventRow = typeof events.$inferSelect;
type EventCategoryRow = typeof eventCategories.$inferSelect;
type EventPricingTierRow = typeof eventPricingTiers.$inferSelect;
type EventStatusValue = EventRow["status"];
interface OrganizerPublishReadinessRow {
	id: string;
	isVerified: boolean;
	razorpayAccountStatus: string;
}

export type EventCategoryStore = Pick<Database, "delete" | "insert" | "select">;
type EventLookupStore = Pick<Database, "select">;

export type EventPricingStore = Pick<Database, "select">;

export type EventPricingTransactionalStore = Pick<
	Database,
	"delete" | "insert" | "select"
>;

export interface EventPricingWriteStore extends EventPricingTransactionalStore {
	transaction: Database["transaction"];
}

export interface EventPricingDeps {
	db: EventPricingWriteStore;
	log: Pick<FastifyBaseLogger, "info">;
}

export interface ApplicableEventPrice {
	eventId: string;
	eventCategoryId: string;
	price: number;
	basePrice: number;
	earlyBirdPrice: number | null;
	earlyBirdDeadline: string | null;
	isEarlyBird: boolean;
	asOf: string;
}

export interface PublishEventResult {
	event: Event;
	transition: EventPublishTransition;
	readiness: PublishReadiness;
}

export interface UnpublishEventResult {
	event: Event;
	transition: EventPublishTransition;
}

export interface EventCategoryTransactionalStore extends EventCategoryStore {
	transaction: Database["transaction"];
}

export interface EventCategoryDeps {
	db: EventCategoryTransactionalStore;
	log: Pick<FastifyBaseLogger, "info">;
}

export type EventPoliciesStore = Pick<Database, "select" | "update">;

export interface EventPoliciesWriteStore extends EventPoliciesStore {
	transaction: Database["transaction"];
}

export interface EventPoliciesDeps {
	db: EventPoliciesWriteStore;
	log: Pick<FastifyBaseLogger, "info">;
}

export type EventRegistrationFormStore = Pick<Database, "select" | "update">;

export interface EventRegistrationFormWriteStore
	extends EventRegistrationFormStore {
	transaction: Database["transaction"];
}

export interface EventRegistrationFormDeps {
	db: EventRegistrationFormWriteStore;
	log: Pick<FastifyBaseLogger, "info">;
}

export interface EventRegistrationFormRecord {
	eventId: string;
	formSchema: EventRegistrationForm;
	formSchemaVersion: EventRegistrationForm["version"];
	updatedAt: string;
}

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: string }).code === "23505"
	);
}

function isPubliclyReadableEventStatus(status: EventStatusValue): boolean {
	return status === "published" || status === "completed";
}

function toEventResponse(row: EventRow): Event {
	return eventSchema.parse({
		id: row.id,
		organizerId: row.organizerId,
		slug: row.slug,
		title: row.title,
		description: row.description,
		eventType: row.eventType,
		sport: row.sport,
		category: row.category,
		venueName: row.venueName,
		addressLine1: row.addressLine1,
		addressLine2: row.addressLine2,
		city: row.city,
		state: row.state,
		country: row.country,
		postalCode: row.postalCode,
		timezone: row.timezone,
		startAt: row.startAt.toISOString(),
		endAt: row.endAt.toISOString(),
		registrationOpensAt: row.registrationOpensAt?.toISOString() ?? null,
		registrationClosesAt: row.registrationClosesAt?.toISOString() ?? null,
		routeDetails: row.routeDetails,
		refundPolicy: row.refundPolicy ?? null,
		cancellationPolicy: row.cancellationPolicy ?? null,
		publishedAt: row.publishedAt?.toISOString() ?? null,
		submittedForReviewAt: row.submittedForReviewAt?.toISOString() ?? null,
		isPaid: row.isPaid,
		currency: row.currency,
		status: row.status,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	});
}

function createReadinessItem(
	check: PublishReadinessCheck,
	passed: boolean,
	message: string,
): PublishReadinessItem {
	return {
		check,
		passed,
		message,
		severity: "error",
	};
}

function getEffectiveTierPrice(
	tier: EventPricingTierWithCategory,
	asOf: Date,
): number {
	if (
		tier.earlyBirdPrice != null &&
		tier.earlyBirdDeadline != null &&
		asOf.getTime() <= new Date(tier.earlyBirdDeadline).getTime()
	) {
		return tier.earlyBirdPrice;
	}

	return tier.basePrice;
}

function getDenialCodes(readiness: PublishReadiness): string[] {
	return readiness.items
		.filter((item) => !item.passed)
		.map((item) => item.check);
}

async function selectUploadedHeroImageExists(
	db: Pick<Database, "select">,
	eventId: string,
): Promise<boolean> {
	const rows = await db
		.select({ id: eventImages.id })
		.from(eventImages)
		.where(
			and(
				eq(eventImages.eventId, eventId),
				eq(eventImages.kind, "hero"),
				eq(eventImages.status, "uploaded"),
			),
		)
		.limit(1);

	return rows.length > 0;
}

export async function getPublishedPaidEventCount(
	db: Pick<Database, "select">,
	organizerId: string,
): Promise<number> {
	const [row] = await db
		.select({ total: sql<number>`count(*)` })
		.from(events)
		.where(
				and(
					eq(events.organizerId, organizerId),
					inArray(events.status, ["published", "completed"]),
					eq(events.isPaid, true),
				),
		)
		.limit(1);

	return Number(row?.total ?? 0);
}

export async function requiresAdminReview(
	db: Pick<Database, "select">,
	organizerId: string,
): Promise<boolean> {
	const publishedPaidEventCount = await getPublishedPaidEventCount(
		db,
		organizerId,
	);
	return publishedPaidEventCount < 3;
}

function invalidateEventCache(_event: Event): void {
	// TODO(I-2.4.2): Purge CDN/public-event cache on publish and unpublish.
}

async function buildPublishReadinessForEvent(
	db: Database,
	event: EventRow,
	organizer: OrganizerPublishReadinessRow,
	now: Date,
	adminReviewPolicy?: (organizerId: string) => Promise<boolean>,
): Promise<PublishReadiness> {
	const categories = await selectEventCategories(db, event.id);
	const tiers = await selectEventPricingTiers(db, event.id, categories);
	const hasHeroImage = await selectUploadedHeroImageExists(db, event.id);
	const effectivePrices = tiers.map((tier) => getEffectiveTierPrice(tier, now));
	const hasPositiveTier = effectivePrices.some((price) => price > 0);
	const isPaid = event.isPaid || hasPositiveTier;
	const requiresRazorpay = isPaid;
	const tierCategoryIds = new Set(tiers.map((tier) => tier.eventCategoryId));
	const pricingCoversEveryCategory =
		categories.length > 0 &&
		tiers.length === categories.length &&
		categories.every((category) => tierCategoryIds.has(category.id));
	const activePricing = tiers.length > 0 && (!isPaid || hasPositiveTier);
	const slugAvailable = !(await slugExists(db, parseEventSlug(event.slug), {
		excludeEventId: event.id,
	}));
	const wouldRequireAdminReview =
		isPaid &&
		(await (adminReviewPolicy ?? ((id) => requiresAdminReview(db, id)))(
			organizer.id,
		));

	const items: PublishReadinessItem[] = [
		createReadinessItem(
			"organizer_verified",
			organizer.isVerified,
			organizer.isVerified
				? "Organizer verified"
				: "Organizer verification is required before publishing",
		),
		createReadinessItem(
			"razorpay_linked",
			!requiresRazorpay || organizer.razorpayAccountStatus === "active",
			!requiresRazorpay || organizer.razorpayAccountStatus === "active"
				? "Razorpay linked account is active"
				: "Paid events require an active Razorpay linked account",
		),
		createReadinessItem(
			"categories_configured",
			categories.length > 0,
			categories.length > 0
				? "Event categories are configured"
				: "Add at least one event category",
		),
		createReadinessItem(
			"pricing_configured",
			pricingCoversEveryCategory,
			pricingCoversEveryCategory
				? "Pricing is configured for every category"
				: "Configure pricing for every event category",
		),
		createReadinessItem(
			"active_pricing",
			activePricing,
			activePricing
				? "At least one active pricing tier is available"
				: "Add at least one active paid pricing tier",
		),
		createReadinessItem(
			"hero_image_uploaded",
			hasHeroImage,
			hasHeroImage ? "Hero image uploaded" : "Upload a hero image",
		),
		createReadinessItem(
			"refund_policy_configured",
			Boolean(event.refundPolicy?.trim()),
			event.refundPolicy?.trim()
				? "Refund policy configured"
				: "Add a refund policy",
		),
		createReadinessItem(
			"cancellation_policy_configured",
			Boolean(event.cancellationPolicy?.trim()),
			event.cancellationPolicy?.trim()
				? "Cancellation policy configured"
				: "Add a cancellation policy",
		),
		createReadinessItem(
			"event_starts_in_future",
			event.startAt.getTime() > now.getTime(),
			event.startAt.getTime() > now.getTime()
				? "Event start time is in the future"
				: "Event start time must be in the future",
		),
		createReadinessItem(
			"event_ends_in_future",
			event.endAt.getTime() > now.getTime(),
			event.endAt.getTime() > now.getTime()
				? "Event end time is in the future"
				: "Event end time must be in the future",
		),
		createReadinessItem(
			"slug_available",
			slugAvailable,
			slugAvailable
				? "Event slug is available"
				: "Event slug is no longer available",
		),
	];

	return {
		ready: items.every((item) => item.passed),
		eventStatus: event.status,
		isPaid,
		requiresRazorpay,
		wouldRequireAdminReview,
		items,
	};
}

async function selectOrganizerForPublishReadiness(
	db: Pick<Database, "select">,
	organizerId: string,
): Promise<OrganizerPublishReadinessRow> {
	const [organizer] = await db
		.select({
			id: organizers.id,
			isVerified: organizers.isVerified,
			razorpayAccountStatus: organizers.razorpayAccountStatus,
		})
		.from(organizers)
		.where(eq(organizers.id, organizerId))
		.limit(1);

	if (!organizer) {
		throw new NotFoundError("Organizer profile not found");
	}

	return organizer;
}

function throwPublishReadinessError(readiness: PublishReadiness): never {
	const denialCodes = getDenialCodes(readiness);
	if (denialCodes.includes("organizer_verified")) {
		throw new AppError(
			"Organizer verification is required before publishing",
			403,
			"ORGANIZER_NOT_VERIFIED",
			{ readiness },
		);
	}
	if (denialCodes.includes("razorpay_linked")) {
		throw new AppError(
			"Paid events require an active Razorpay linked account",
			403,
			"RAZORPAY_NOT_LINKED",
			{ readiness },
		);
	}
	if (denialCodes.includes("slug_available")) {
		throw new AppError(
			"Event slug is no longer available",
			409,
			"EVENT_SLUG_CONFLICT",
			{ readiness },
		);
	}
	if (
		denialCodes.includes("event_starts_in_future") ||
		denialCodes.includes("event_ends_in_future")
	) {
		throw new AppError(
			"Event dates must be in the future before publishing",
			400,
			"EVENT_DATE_IN_PAST",
			{ readiness },
		);
	}
	if (denialCodes.includes("active_pricing")) {
		throw new AppError(
			"Event pricing must include an active paid tier",
			400,
			"EVENT_PRICING_INACTIVE",
			{ readiness },
		);
	}
	throw new AppError(
		"Event is incomplete and cannot be published",
		400,
		"EVENT_INCOMPLETE",
		{ readiness },
	);
}

async function getOwnedEventAndOrganizer(
	db: Database,
	userId: string,
	eventId: string,
	options: { forUpdate?: boolean } = {},
) {
	const parsedEventId = parseUuid(eventId, "event id");
	const organizer = await getOrganizerByUserId(db, userId);
	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const event = await selectEventForCategories(db, parsedEventId, options);
	if (event.organizerId !== organizer.id) {
		throw new ForbiddenError("You do not have access to this event");
	}

	return { event, organizer };
}

async function auditPublishDenied(
	deps: EventPublishDeps,
	input: {
		userId: string;
		organizerId: string;
		eventId: string;
		readiness: PublishReadiness;
		ipAddress?: string;
	},
) {
	await deps.auditLogger.log({
		actorId: input.userId,
		actorRole: "organizer",
		action: AUDIT_ACTIONS.EVENT_PUBLISH_DENIED,
		resourceType: "event",
		resourceId: input.eventId,
		ipAddress: input.ipAddress,
		metadata: {
			organizerId: input.organizerId,
			denialCodes: getDenialCodes(input.readiness),
		},
	});
}

function parseUuid(value: string, fieldName: string): string {
	const parsed = uuidSchema.safeParse(value);
	if (!parsed.success) {
		throw new ValidationError(
			`Invalid ${fieldName}`,
			toValidationDetails(parsed.error),
		);
	}

	return parsed.data;
}

function toEventCategoryResponse(row: EventCategoryRow): EventCategoryRecord {
	return eventCategoryRecordSchema.parse({
		id: row.id,
		eventId: row.eventId,
		name: row.name,
		slug: row.slug,
		distanceMeters: row.distanceMeters,
		sortOrder: row.sortOrder,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	});
}

function toEventPricingTierResponse(
	row: EventPricingTierRow,
	category: EventCategoryRecord,
): EventPricingTierWithCategory {
	return eventPricingTierWithCategorySchema.parse({
		id: row.id,
		eventId: row.eventId,
		eventCategoryId: row.eventCategoryId,
		basePrice: row.basePrice,
		earlyBirdPrice: row.earlyBirdPrice,
		earlyBirdDeadline: row.earlyBirdDeadline?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		category,
	});
}

function toEventPoliciesResponse(
	row: Pick<
		EventRow,
		"id" | "refundPolicy" | "cancellationPolicy" | "updatedAt"
	>,
): EventPoliciesRecord {
	return eventPoliciesRecordSchema.parse({
		eventId: row.id,
		refundPolicy: row.refundPolicy ?? null,
		cancellationPolicy: row.cancellationPolicy ?? null,
		updatedAt: row.updatedAt.toISOString(),
	});
}

function toEventRegistrationFormResponse(
	row: Pick<EventRow, "id" | "formSchema" | "formSchemaVersion" | "updatedAt">,
): EventRegistrationFormRecord {
	const formSchema = eventRegistrationFormSchema.parse(
		row.formSchema ?? defaultEventRegistrationFormSchema,
	);

	return {
		eventId: row.id,
		formSchema,
		formSchemaVersion: formSchema.version,
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toValidationDetails(error: {
	issues: Array<{ path: PropertyKey[]; message: string; code: string }>;
}) {
	return {
		issues: error.issues.map((issue) => ({
			code: issue.code,
			message: issue.message,
			path: issue.path.map(String),
		})),
	};
}

async function selectEventForCategories(
	db: EventLookupStore,
	eventId: string,
	options: { forUpdate?: boolean } = {},
) {
	const query = db.select().from(events).where(eq(events.id, eventId));

	const [event] = options.forUpdate
		? await query.for("update").limit(1)
		: await query.limit(1);

	if (!event) {
		throw new NotFoundError("Event not found");
	}

	return event;
}

export async function getEvent(
	db: EventLookupStore,
	eventId: string,
	userId?: string,
): Promise<Event> {
	const parsedEventId = parseUuid(eventId, "event id");
	const event = await assertEventReadable(db, parsedEventId, userId);

	return toEventResponse(event);
}

async function assertEventReadable(
	db: EventLookupStore,
	eventId: string,
	userId?: string,
) {
	const event = await selectEventForCategories(db, eventId);
	if (isPubliclyReadableEventStatus(event.status)) {
		return event;
	}

	if (!userId) {
		throw new NotFoundError("Event not found");
	}

	const organizer = await getOrganizerByUserId(db as Database, userId);
	if (organizer?.id === event.organizerId) {
		return event;
	}

	throw new NotFoundError("Event not found");
}

async function selectEventCategories(
	db: EventCategoryStore,
	eventId: string,
): Promise<EventCategoryRecord[]> {
	const rows = await db
		.select()
		.from(eventCategories)
		.where(eq(eventCategories.eventId, eventId))
		.orderBy(eventCategories.sortOrder);

	return rows.map((row) => toEventCategoryResponse(row));
}

async function selectEventPricingTiers(
	db: EventPricingStore,
	eventId: string,
	categories: readonly EventCategoryRecord[],
): Promise<EventPricingTierWithCategory[]> {
	const rows = await db
		.select()
		.from(eventPricingTiers)
		.where(eq(eventPricingTiers.eventId, eventId))
		.orderBy(eventPricingTiers.eventCategoryId);
	const categoryById = new Map(
		categories.map((category) => [category.id, category] as const),
	);

	return rows
		.map((row) => {
			const category = categoryById.get(row.eventCategoryId);
			return category ? toEventPricingTierResponse(row, category) : null;
		})
		.filter((tier): tier is EventPricingTierWithCategory => tier !== null)
		.sort((left, right) => left.category.sortOrder - right.category.sortOrder);
}

export async function getApplicableEventPrice(
	db: EventPricingStore,
	eventId: string,
	eventCategoryId: string,
	asOf = new Date(),
): Promise<ApplicableEventPrice> {
	const parsedEventId = parseUuid(eventId, "event id");
	const parsedCategoryId = parseUuid(eventCategoryId, "event category id");
	if (Number.isNaN(asOf.getTime())) {
		throw new ValidationError("Invalid pricing timestamp");
	}

	const [event] = await db
		.select({ id: events.id })
		.from(events)
		.where(eq(events.id, parsedEventId))
		.limit(1);

	if (!event) {
		throw new NotFoundError("Event not found");
	}

	const [category] = await db
		.select({ id: eventCategories.id })
		.from(eventCategories)
		.where(
			and(
				eq(eventCategories.id, parsedCategoryId),
				eq(eventCategories.eventId, parsedEventId),
			),
		)
		.limit(1);

	if (!category) {
		throw new ValidationError("Event category does not belong to this event");
	}

	const [tier] = await db
		.select()
		.from(eventPricingTiers)
		.where(
			and(
				eq(eventPricingTiers.eventId, parsedEventId),
				eq(eventPricingTiers.eventCategoryId, parsedCategoryId),
			),
		)
		.limit(1);

	if (!tier) {
		throw new NotFoundError(
			"Event pricing is not configured for this category",
		);
	}

	const isEarlyBird =
		tier.earlyBirdPrice != null &&
		tier.earlyBirdDeadline != null &&
		asOf.getTime() <= tier.earlyBirdDeadline.getTime();
	const price =
		isEarlyBird && tier.earlyBirdPrice != null
			? tier.earlyBirdPrice
			: tier.basePrice;

	return {
		eventId: parsedEventId,
		eventCategoryId: parsedCategoryId,
		price,
		basePrice: tier.basePrice,
		earlyBirdPrice: tier.earlyBirdPrice,
		earlyBirdDeadline: tier.earlyBirdDeadline?.toISOString() ?? null,
		isEarlyBird,
		asOf: asOf.toISOString(),
	};
}

function validatePricingCoversCategories(
	config: EventPricingConfig,
	categories: readonly EventCategoryRecord[],
) {
	const categoryIds = new Set(categories.map((category) => category.id));
	const tierCategoryIds = new Set(
		config.tiers.map((tier) => tier.eventCategoryId),
	);
	const unknownTierIndex = config.tiers.findIndex(
		(tier) => !categoryIds.has(tier.eventCategoryId),
	);

	if (unknownTierIndex >= 0) {
		throw new ValidationError("Invalid event pricing configuration", {
			issues: [
				{
					code: "custom",
					message: "Pricing tiers must reference categories for this event",
					path: ["tiers", String(unknownTierIndex), "eventCategoryId"],
				},
			],
		});
	}

	if (
		config.tiers.length !== categories.length ||
		categories.some((category) => !tierCategoryIds.has(category.id))
	) {
		throw new ValidationError("Invalid event pricing configuration", {
			issues: [
				{
					code: "custom",
					message: "Provide pricing for every event category",
					path: ["tiers"],
				},
			],
		});
	}
}

export async function createDraftEvent(
	deps: CreateDraftEventDeps,
	userId: string,
	input: unknown,
): Promise<Event> {
	const parsed = createEventInputSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid event details",
			toValidationDetails(parsed.error),
		);
	}

	const { db, log } = deps;
	const organizer = await getOrganizerByUserId(db, userId);

	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const data = parsed.data;

	for (let attempt = 1; attempt <= 3; attempt += 1) {
		const slug = await generateUniqueEventSlug(db, data.title);

		try {
			const [inserted] = await db
				.insert(events)
				.values({
					organizerId: organizer.id,
					title: data.title,
					slug,
					description: data.description,
					eventType: data.eventType,
					sport: data.sport,
					category: data.category,
					venueName: data.venueName,
					addressLine1: data.addressLine1,
					addressLine2: data.addressLine2 ?? null,
					city: data.city,
					state: data.state,
					country: data.country,
					postalCode: data.postalCode ?? null,
					timezone: data.timezone,
					startAt: new Date(data.startAt),
					endAt: new Date(data.endAt),
					registrationOpensAt: data.registrationOpensAt
						? new Date(data.registrationOpensAt)
						: null,
					registrationClosesAt: data.registrationClosesAt
						? new Date(data.registrationClosesAt)
						: null,
					routeDetails: data.routeDetails,
					isPaid: data.isPaid,
					currency: data.currency,
					status: DEFAULT_EVENT_STATUS,
				})
				.returning();

			if (!inserted) {
				throw new Error("Failed to insert event record");
			}

			log.info(
				{ eventId: inserted.id, organizerId: organizer.id, userId },
				"Draft event created",
			);

			return toEventResponse(inserted);
		} catch (error: unknown) {
			if (isUniqueViolation(error) && attempt < 3) {
				continue;
			}

			if (isUniqueViolation(error)) {
				throw new ConflictError("Unable to reserve a unique event slug");
			}

			throw error;
		}
	}

	throw new ConflictError("Unable to reserve a unique event slug");
}

export async function updateDraftEvent(
	deps: UpdateDraftEventDeps,
	userId: string,
	eventId: string,
	input: unknown,
): Promise<Event> {
	const parsedEventId = parseUuid(eventId, "event id");
	const parsed = updateEventInputSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid event details",
			toValidationDetails(parsed.error),
		);
	}

	const { db, log } = deps;
	const organizer = await getOrganizerByUserId(db, userId);

	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const event = await db.transaction(async (tx) => {
		const currentEvent = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});

		if (currentEvent.organizerId !== organizer.id) {
			throw new ForbiddenError("You do not have access to this event");
		}

		if (currentEvent.status !== DEFAULT_EVENT_STATUS) {
			throw new ConflictError(
				"Event details can only be updated while the event is in draft status",
			);
		}

		const data: UpdateEvent = parsed.data;
		const currentSlug = parseEventSlug(currentEvent.slug);
		let slug: EventSlug = currentSlug;

		if (data.title !== currentEvent.title) {
			slug = await reserveUniqueEventSlug(tx, data.title, {
				excludeEventId: parsedEventId,
			});
		}

		const [updated] = await tx
			.update(events)
			.set({
				title: data.title,
				slug,
				description: data.description,
				venueName: data.venueName,
				addressLine1: data.addressLine1,
				addressLine2: data.addressLine2 ?? null,
				postalCode: data.postalCode ?? null,
				startAt: new Date(data.startAt),
				endAt: new Date(data.endAt),
				registrationOpensAt: data.registrationOpensAt
					? new Date(data.registrationOpensAt)
					: null,
				registrationClosesAt: data.registrationClosesAt
					? new Date(data.registrationClosesAt)
					: null,
				routeDetails: data.routeDetails,
				updatedAt: new Date(),
			})
			.where(eq(events.id, parsedEventId))
			.returning();

		if (!updated) {
			throw new Error("Failed to update event details");
		}

		if (currentSlug !== slug) {
			await recordEventSlugRedirect(tx, {
				eventId: parsedEventId,
				oldSlug: currentSlug,
				newSlug: slug,
			});
		}

		return toEventResponse(updated);
	});

	log.info(
		{
			eventId: parsedEventId,
			organizerId: organizer.id,
			userId,
			slug: event.slug,
		},
		"Draft event updated",
	);

	return event;
}

export async function listEventCategories(
	db: EventCategoryStore,
	eventId: string,
	userId?: string,
): Promise<EventCategoryRecord[]> {
	const parsedEventId = parseUuid(eventId, "event id");
	await assertEventReadable(db, parsedEventId, userId);

	return selectEventCategories(db, parsedEventId);
}

export async function getEventPolicies(
	db: EventPoliciesStore,
	eventId: string,
	userId?: string,
): Promise<EventPoliciesRecord> {
	const parsedEventId = parseUuid(eventId, "event id");
	await assertEventReadable(db, parsedEventId, userId);
	const [event] = await db
		.select({
			id: events.id,
			refundPolicy: events.refundPolicy,
			cancellationPolicy: events.cancellationPolicy,
			updatedAt: events.updatedAt,
		})
		.from(events)
		.where(eq(events.id, parsedEventId))
		.limit(1);

	if (!event) {
		throw new NotFoundError("Event not found");
	}

	return toEventPoliciesResponse(event);
}

export async function updateEventPolicies(
	deps: EventPoliciesDeps,
	userId: string,
	eventId: string,
	input: unknown,
): Promise<EventPoliciesRecord> {
	const parsedEventId = parseUuid(eventId, "event id");
	const parsed = eventPoliciesConfigSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid event policy configuration",
			toValidationDetails(parsed.error),
		);
	}

	const organizer = await getOrganizerByUserId(deps.db as Database, userId);

	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const policies = await deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});

		if (event.organizerId !== organizer.id) {
			throw new ForbiddenError("You do not have access to this event");
		}

		if (event.status !== DEFAULT_EVENT_STATUS) {
			throw new ConflictError(
				"Event policies can only be updated while the event is in draft status",
			);
		}

		const data: EventPoliciesConfig = parsed.data;
		const [updated] = await tx
			.update(events)
			.set({
				refundPolicy: data.refundPolicy,
				cancellationPolicy: data.cancellationPolicy,
				updatedAt: new Date(),
			})
			.where(eq(events.id, parsedEventId))
			.returning({
				id: events.id,
				refundPolicy: events.refundPolicy,
				cancellationPolicy: events.cancellationPolicy,
				updatedAt: events.updatedAt,
			});

		if (!updated) {
			throw new Error("Failed to update event policies");
		}

		return toEventPoliciesResponse(updated);
	});

	deps.log.info(
		{
			eventId: parsedEventId,
			organizerId: organizer.id,
			userId,
		},
		"Event policies updated",
	);

	return policies;
}

export async function getEventRegistrationForm(
	db: EventRegistrationFormStore,
	userId: string,
	eventId: string,
): Promise<EventRegistrationFormRecord> {
	const parsedEventId = parseUuid(eventId, "event id");
	const organizer = await getOrganizerByUserId(db as Database, userId);

	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const [event] = await db
		.select({
			id: events.id,
			organizerId: events.organizerId,
			formSchema: events.formSchema,
			formSchemaVersion: events.formSchemaVersion,
			updatedAt: events.updatedAt,
		})
		.from(events)
		.where(eq(events.id, parsedEventId))
		.limit(1);

	if (!event) {
		throw new NotFoundError("Event not found");
	}

	if (event.organizerId !== organizer.id) {
		throw new ForbiddenError("You do not have access to this event");
	}

	return toEventRegistrationFormResponse(event);
}

export async function updateEventRegistrationForm(
	deps: EventRegistrationFormDeps,
	userId: string,
	eventId: string,
	input: unknown,
): Promise<EventRegistrationFormRecord> {
	const parsedEventId = parseUuid(eventId, "event id");
	const parsed = eventRegistrationFormSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid event registration form configuration",
			toValidationDetails(parsed.error),
		);
	}

	const organizer = await getOrganizerByUserId(deps.db as Database, userId);

	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const registrationForm = await deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});

		if (event.organizerId !== organizer.id) {
			throw new ForbiddenError("You do not have access to this event");
		}

		if (event.status !== DEFAULT_EVENT_STATUS) {
			throw new ConflictError(
				"Event registration form can only be updated while the event is in draft status",
			);
		}

		const data: EventRegistrationForm = parsed.data;
		const [updated] = await tx
			.update(events)
			.set({
				formSchema: data,
				formSchemaVersion: data.version,
				updatedAt: new Date(),
			})
			.where(eq(events.id, parsedEventId))
			.returning({
				id: events.id,
				formSchema: events.formSchema,
				formSchemaVersion: events.formSchemaVersion,
				updatedAt: events.updatedAt,
			});

		if (!updated) {
			throw new Error("Failed to update event registration form");
		}

		return toEventRegistrationFormResponse(updated);
	});

	deps.log.info(
		{
			eventId: parsedEventId,
			organizerId: organizer.id,
			userId,
			formSchemaVersion: registrationForm.formSchemaVersion,
		},
		"Event registration form updated",
	);

	return registrationForm;
}

export async function replaceEventCategories(
	deps: EventCategoryDeps,
	userId: string,
	eventId: string,
	input: unknown,
): Promise<EventCategoryRecord[]> {
	const parsedEventId = parseUuid(eventId, "event id");
	const parsed = eventCategoriesConfigSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid event category configuration",
			toValidationDetails(parsed.error),
		);
	}

	const organizer = await getOrganizerByUserId(deps.db as Database, userId);

	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const sortedCategories = [...parsed.data.categories].sort(
		(left, right) => left.sortOrder - right.sortOrder,
	);

	const categories = await deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});

		if (event.organizerId !== organizer.id) {
			throw new ForbiddenError("You do not have access to this event");
		}

		if (event.status !== DEFAULT_EVENT_STATUS) {
			throw new ConflictError(
				"Event categories can only be updated while the event is in draft status",
			);
		}

		const existingPricing = await tx
			.select({ id: eventPricingTiers.id })
			.from(eventPricingTiers)
			.where(eq(eventPricingTiers.eventId, parsedEventId))
			.limit(1);

		if (existingPricing.length > 0) {
			throw new ConflictError(
				"Event categories cannot be replaced after pricing is configured",
			);
		}

		await tx
			.delete(eventCategories)
			.where(eq(eventCategories.eventId, parsedEventId));

		await tx.insert(eventCategories).values(
			sortedCategories.map((category) => ({
				eventId: parsedEventId,
				name: category.name,
				slug: category.slug,
				distanceMeters: category.distanceMeters,
				sortOrder: category.sortOrder,
			})),
		);

		return selectEventCategories(tx, parsedEventId);
	});

	deps.log.info(
		{
			eventId: parsedEventId,
			organizerId: organizer.id,
			userId,
			categoryCount: categories.length,
		},
		"Event categories replaced",
	);

	return categories;
}

export async function listEventPricing(
	db: EventCategoryStore & EventPricingStore,
	eventId: string,
	userId?: string,
): Promise<EventPricingTierWithCategory[]> {
	const parsedEventId = parseUuid(eventId, "event id");
	await assertEventReadable(db, parsedEventId, userId);
	const categories = await selectEventCategories(db, parsedEventId);

	return selectEventPricingTiers(db, parsedEventId, categories);
}

export async function replaceEventPricing(
	deps: EventPricingDeps,
	userId: string,
	eventId: string,
	input: unknown,
): Promise<EventPricingTierWithCategory[]> {
	const parsedEventId = parseUuid(eventId, "event id");
	const parsed = eventPricingConfigSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid event pricing configuration",
			toValidationDetails(parsed.error),
		);
	}

	const organizer = await getOrganizerByUserId(deps.db as Database, userId);

	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const tiers = await deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});

		if (event.organizerId !== organizer.id) {
			throw new ForbiddenError("You do not have access to this event");
		}

		if (event.status !== DEFAULT_EVENT_STATUS) {
			throw new ConflictError(
				"Event pricing can only be updated while the event is in draft status",
			);
		}

		const categories = await selectEventCategories(tx, parsedEventId);
		if (categories.length === 0) {
			throw new ConflictError("Configure event categories before pricing");
		}

		validatePricingCoversCategories(parsed.data, categories);
		const categoryOrder = new Map(
			categories.map((category) => [category.id, category.sortOrder] as const),
		);
		const sortedTiers = [...parsed.data.tiers].sort(
			(left, right) =>
				(categoryOrder.get(left.eventCategoryId) ?? 0) -
				(categoryOrder.get(right.eventCategoryId) ?? 0),
		);

		await tx
			.delete(eventPricingTiers)
			.where(eq(eventPricingTiers.eventId, parsedEventId));

		await tx.insert(eventPricingTiers).values(
			sortedTiers.map((tier) => ({
				eventId: parsedEventId,
				eventCategoryId: tier.eventCategoryId,
				basePrice: tier.basePrice,
				earlyBirdPrice: tier.earlyBirdPrice ?? null,
				earlyBirdDeadline: tier.earlyBirdDeadline
					? new Date(tier.earlyBirdDeadline)
					: null,
			})),
		);

		return selectEventPricingTiers(tx, parsedEventId, categories);
	});

	deps.log.info(
		{
			eventId: parsedEventId,
			organizerId: organizer.id,
			userId,
			tierCount: tiers.length,
		},
		"Event pricing replaced",
	);

	return tiers;
}

export async function getPublishReadiness(
	db: Database,
	userId: string,
	eventId: string,
): Promise<PublishReadiness> {
	const { event, organizer } = await getOwnedEventAndOrganizer(
		db,
		userId,
		eventId,
	);

	return buildPublishReadinessForEvent(db, event, organizer, new Date());
}

export async function publishEvent(
	deps: EventPublishDeps,
	userId: string,
	eventId: string,
	ipAddress?: string,
): Promise<PublishEventResult> {
	const result = await deps.db.transaction(async (tx) => {
		const { event, organizer } = await getOwnedEventAndOrganizer(
			tx as unknown as Database,
			userId,
			eventId,
			{ forUpdate: true },
		);

		const readiness = await buildPublishReadinessForEvent(
			tx as unknown as Database,
			event,
			organizer,
			new Date(),
			deps.requiresAdminReview,
		);

		if (event.status === "published") {
			return {
				event: toEventResponse(event),
				transition: "noop_already_published" as const,
				readiness,
			};
		}

		if (event.status === "under_review") {
			return {
				event: toEventResponse(event),
				transition: "noop_already_under_review" as const,
				readiness,
			};
		}

		if (event.status === "completed" || event.status === "cancelled") {
			await auditPublishDenied(deps, {
				userId,
				organizerId: organizer.id,
				eventId: event.id,
				readiness,
				ipAddress,
			});
			throw new ConflictError(
				"Event cannot be published from its current state",
			);
		}

		if (event.status !== DEFAULT_EVENT_STATUS) {
			await auditPublishDenied(deps, {
				userId,
				organizerId: organizer.id,
				eventId: event.id,
				readiness,
				ipAddress,
			});
			throw new AppError(
				"Event can only be published from draft status",
				400,
				"EVENT_NOT_PUBLISHABLE",
				{ readiness },
			);
		}

		if (!readiness.ready) {
			await auditPublishDenied(deps, {
				userId,
				organizerId: organizer.id,
				eventId: event.id,
				readiness,
				ipAddress,
			});
			throwPublishReadinessError(readiness);
		}

		await deps.auditLogger.log({
			actorId: userId,
			actorRole: "organizer",
			action: AUDIT_ACTIONS.EVENT_PUBLISH_REQUESTED,
			resourceType: "event",
			resourceId: event.id,
			ipAddress,
			metadata: {
				organizerId: organizer.id,
				from: event.status,
			},
		});

		const now = new Date();
		const transition: EventPublishTransition =
			readiness.wouldRequireAdminReview === true
				? "draft_to_under_review"
				: "draft_to_published";
		const [updated] = await tx
			.update(events)
			.set({
				status:
					transition === "draft_to_under_review" ? "under_review" : "published",
				publishedAt: transition === "draft_to_published" ? now : null,
				submittedForReviewAt:
					transition === "draft_to_under_review" ? now : null,
				updatedAt: now,
			})
			.where(
				and(eq(events.id, event.id), eq(events.status, DEFAULT_EVENT_STATUS)),
			)
			.returning();

		if (!updated) {
			throw new ConflictError("Event publish status changed. Please retry.");
		}

		await deps.auditLogger.log({
			actorId: userId,
			actorRole: "organizer",
			action:
				transition === "draft_to_under_review"
					? AUDIT_ACTIONS.EVENT_SUBMIT_FOR_REVIEW
					: AUDIT_ACTIONS.EVENT_PUBLISH,
			resourceType: "event",
			resourceId: event.id,
			ipAddress,
			metadata: {
				organizerId: organizer.id,
				transition,
			},
		});

		const responseEvent = toEventResponse(updated);
		invalidateEventCache(responseEvent);
		return { event: responseEvent, transition, readiness };
	});

	deps.log.info(
		{
			eventId,
			userId,
			transition: result.transition,
		},
		"Event publish workflow completed",
	);

	return result;
}

export async function unpublishEvent(
	deps: EventPublishDeps,
	userId: string,
	eventId: string,
	ipAddress?: string,
): Promise<UnpublishEventResult> {
	const result = await deps.db.transaction(async (tx) => {
		const { event, organizer } = await getOwnedEventAndOrganizer(
			tx as unknown as Database,
			userId,
			eventId,
			{ forUpdate: true },
		);

		if (event.status !== "published") {
			if (event.status === "completed" || event.status === "cancelled") {
				throw new ConflictError("Event cannot be unpublished from this state");
			}
			throw new AppError(
				"Only published events can be unpublished",
				400,
				"EVENT_NOT_UNPUBLISHABLE",
			);
		}

		// TODO(Phase 3 bookings): block unpublish when confirmed bookings/tickets exist.
		const now = new Date();
		const [updated] = await tx
			.update(events)
			.set({
				status: DEFAULT_EVENT_STATUS,
				publishedAt: null,
				updatedAt: now,
			})
			.where(and(eq(events.id, event.id), eq(events.status, "published")))
			.returning();

		if (!updated) {
			throw new ConflictError("Event unpublish status changed. Please retry.");
		}

		await deps.auditLogger.log({
			actorId: userId,
			actorRole: "organizer",
			action: AUDIT_ACTIONS.EVENT_UNPUBLISH,
			resourceType: "event",
			resourceId: event.id,
			ipAddress,
			metadata: {
				organizerId: organizer.id,
				transition: "published_to_draft",
			},
		});

		const responseEvent = toEventResponse(updated);
		invalidateEventCache(responseEvent);
		return {
			event: responseEvent,
			transition: "published_to_draft" as const,
		};
	});

	deps.log.info(
		{
			eventId,
			userId,
			transition: result.transition,
		},
		"Event unpublish workflow completed",
	);

	return result;
}

export async function adminApproveEvent(
	deps: EventPublishDeps,
	eventId: string,
	adminUserId: string,
	ipAddress?: string,
	notes?: string,
): Promise<PublishEventResult> {
	const parsedEventId = parseUuid(eventId, "event id");
	const result = await deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});
		if (event.status !== "under_review") {
			throw new ConflictError("Only events under review can be approved");
		}
		const organizer = await selectOrganizerForPublishReadiness(
			tx as unknown as Database,
			event.organizerId,
		);
		const now = new Date();
		const readiness = await buildPublishReadinessForEvent(
			tx as unknown as Database,
			event,
			organizer,
			now,
			deps.requiresAdminReview,
		);
		if (!readiness.ready) {
			await deps.auditLogger.log({
				actorId: adminUserId,
				actorRole: "admin",
				action: AUDIT_ACTIONS.EVENT_PUBLISH_DENIED,
				resourceType: "event",
				resourceId: parsedEventId,
				ipAddress,
				metadata: {
					organizerId: event.organizerId,
					source: "admin_review",
					denialCodes: getDenialCodes(readiness),
				},
			});
			throwPublishReadinessError(readiness);
		}
		const [updated] = await tx
			.update(events)
			.set({
				status: "published",
				publishedAt: now,
				updatedAt: now,
			})
			.where(
				and(eq(events.id, parsedEventId), eq(events.status, "under_review")),
			)
			.returning();
		if (!updated) {
			throw new ConflictError("Event review status changed. Please retry.");
		}
		await deps.auditLogger.log({
			actorId: adminUserId,
			actorRole: "admin",
			action: AUDIT_ACTIONS.EVENT_PUBLISH,
			resourceType: "event",
			resourceId: parsedEventId,
			ipAddress,
			metadata: {
				organizerId: event.organizerId,
				source: "admin_review",
				transition: "under_review_to_published",
				...(notes ? { notes } : {}),
			},
		});
		const responseEvent = toEventResponse(updated);
		invalidateEventCache(responseEvent);
		return {
			event: responseEvent,
			transition: "under_review_to_published" as const,
			readiness,
		};
	});

	return result;
}

export async function adminRejectEvent(
	deps: EventPublishDeps,
	eventId: string,
	adminUserId: string,
	reason?: string,
	ipAddress?: string,
): Promise<UnpublishEventResult> {
	const parsedEventId = parseUuid(eventId, "event id");
	return deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});
		if (event.status !== "under_review") {
			throw new ConflictError("Only events under review can be rejected");
		}
		const now = new Date();
		const [updated] = await tx
			.update(events)
			.set({
				status: DEFAULT_EVENT_STATUS,
				publishedAt: null,
				updatedAt: now,
			})
			.where(
				and(eq(events.id, parsedEventId), eq(events.status, "under_review")),
			)
			.returning();
		if (!updated) {
			throw new ConflictError("Event review status changed. Please retry.");
		}
		await deps.auditLogger.log({
			actorId: adminUserId,
			actorRole: "admin",
			action: AUDIT_ACTIONS.EVENT_PUBLISH_REJECTED,
			resourceType: "event",
			resourceId: parsedEventId,
			ipAddress,
			metadata: {
				organizerId: event.organizerId,
				source: "admin_review",
				transition: "under_review_to_draft",
				...(reason ? { reason } : {}),
			},
		});
		return {
			event: toEventResponse(updated),
			transition: "under_review_to_draft" as const,
		};
	});
}

function parseEventSlug(slug: string): EventSlug {
	return eventSlugSchema.parse(slug);
}

function getMaxAttempts(maxAttempts = DEFAULT_EVENT_SLUG_MAX_ATTEMPTS): number {
	if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
		throw new RangeError("Slug maxAttempts must be a positive safe integer.");
	}

	return maxAttempts;
}

function buildSlugCandidate(baseSlug: string, attempt: number): EventSlug {
	const candidate =
		attempt === 1 ? baseSlug : appendEventSlugSuffix(baseSlug, attempt);

	return parseEventSlug(candidate);
}

async function slugExists(
	db: EventSlugStore,
	slug: EventSlug,
	options: Pick<ReserveEventSlugOptions, "excludeEventId">,
): Promise<boolean> {
	const activeSlugWhere = options.excludeEventId
		? and(eq(events.slug, slug), ne(events.id, options.excludeEventId))
		: eq(events.slug, slug);

	const activeMatches = await db
		.select({ id: events.id })
		.from(events)
		.where(activeSlugWhere)
		.limit(1);

	if (activeMatches.length > 0) return true;

	const redirectWhere = options.excludeEventId
		? and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.oldSlug, slug),
				ne(slugRedirects.resourceId, options.excludeEventId),
			)
		: and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.oldSlug, slug),
			);

	const redirectMatches = await db
		.select({ id: slugRedirects.id })
		.from(slugRedirects)
		.where(redirectWhere)
		.limit(1);

	return redirectMatches.length > 0;
}

export async function reserveUniqueEventSlug(
	db: EventSlugStore,
	slugCandidate: string,
	options: ReserveEventSlugOptions = {},
): Promise<EventSlug> {
	const maxAttempts = getMaxAttempts(options.maxAttempts);
	const baseSlug = normalizeEventSlug(slugCandidate);

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const candidate = buildSlugCandidate(baseSlug, attempt);

		if (!(await slugExists(db, candidate, options))) {
			return candidate;
		}
	}

	throw new ConflictError(
		`Unable to reserve a unique event slug after ${maxAttempts} attempts`,
	);
}

export async function generateUniqueEventSlug(
	db: EventSlugStore,
	slugCandidate: string,
	options: ReserveEventSlugOptions = {},
): Promise<EventSlug> {
	return reserveUniqueEventSlug(db, slugCandidate, options);
}

export async function recordEventSlugRedirect(
	db: EventSlugStore,
	input: EventSlugRedirectInput,
): Promise<EventSlugRedirectResult> {
	const oldSlug = parseEventSlug(input.oldSlug);
	const newSlug = parseEventSlug(input.newSlug);

	if (oldSlug === newSlug) {
		return { recorded: false };
	}

	await db
		.delete(slugRedirects)
		.where(
			and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.resourceId, input.eventId),
				eq(slugRedirects.oldSlug, newSlug),
			),
		);

	await db
		.update(slugRedirects)
		.set({ newSlug })
		.where(
			and(
				eq(slugRedirects.resourceType, EVENT_SLUG_RESOURCE_TYPE),
				eq(slugRedirects.resourceId, input.eventId),
				eq(slugRedirects.newSlug, oldSlug),
			),
		);

	await db
		.insert(slugRedirects)
		.values({
			oldSlug,
			newSlug,
			resourceType: EVENT_SLUG_RESOURCE_TYPE,
			resourceId: input.eventId,
		})
		.onConflictDoUpdate({
			target: [slugRedirects.resourceType, slugRedirects.oldSlug],
			set: {
				newSlug,
				resourceId: input.eventId,
			},
		});

	return { recorded: true };
}

async function getCurrentEventSlug(
	db: EventSlugStore,
	eventId: string,
): Promise<EventSlug> {
	const [event] = await db
		.select({ slug: events.slug })
		.from(events)
		.where(eq(events.id, eventId))
		.limit(1);

	if (!event) {
		throw new NotFoundError("Event not found");
	}

	return parseEventSlug(event.slug);
}

export async function updateEventSlug(
	db: EventSlugTransactionalStore,
	input: UpdateEventSlugInput,
	options: ReserveEventSlugOptions = {},
): Promise<UpdateEventSlugResult> {
	return db.transaction(async (tx) => {
		const currentSlug = input.currentSlug
			? parseEventSlug(input.currentSlug)
			: await getCurrentEventSlug(tx, input.eventId);
		const newSlug = await reserveUniqueEventSlug(tx, input.slugCandidate, {
			...options,
			excludeEventId: input.eventId,
		});

		if (currentSlug === newSlug) {
			return {
				changed: false,
				previousSlug: currentSlug,
				slug: currentSlug,
			};
		}

		const [updated] = await tx
			.update(events)
			.set({ slug: newSlug })
			.where(eq(events.id, input.eventId))
			.returning({ slug: events.slug });

		if (!updated) {
			throw new NotFoundError("Event not found");
		}

		const updatedSlug = parseEventSlug(updated.slug);
		await recordEventSlugRedirect(tx, {
			eventId: input.eventId,
			oldSlug: currentSlug,
			newSlug: updatedSlug,
		});

		return {
			changed: true,
			previousSlug: currentSlug,
			slug: updatedSlug,
		};
	});
}
