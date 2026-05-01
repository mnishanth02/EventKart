import { and, type Database, eq, ne, sql } from "@repo/db";
import {
	eventCategories,
	eventImages,
	eventPricingTiers,
	events,
	organizers,
	slugRedirects,
} from "@repo/db/schema";
import {
	AUDIT_ACTIONS,
	buildEmailIdempotencyKey,
	DEFAULT_EVENT_STATUS,
	EMAIL_JOB_NAMES,
	PUBLISHED_EVENT_HIGH_RISK_FIELDS,
	PUBLISHED_EVENT_LOW_RISK_FIELDS,
} from "@repo/shared/constants";
import type {
	Event,
	EventCategoryRecord,
	EventPoliciesConfig,
	EventPoliciesRecord,
	EventPricingConfig,
	EventPricingTierWithCategory,
	EventPublishTransition,
	EventRegistrationForm,
	EventSlug,
	PublishReadiness,
	PublishReadinessCheck,
	PublishReadinessItem,
	UpdateEvent,
} from "@repo/shared/schemas";
import {
	createEventInputSchema,
	defaultEventRegistrationFormSchema,
	eventCategoriesConfigSchema,
	eventCategoryCapacityUpdateSchema,
	eventCategoryRecordSchema,
	eventPoliciesConfigSchema,
	eventPoliciesRecordSchema,
	eventPricingConfigSchema,
	eventPricingTierWithCategorySchema,
	eventRegistrationFormSchema,
	eventSchema,
	eventSlugSchema,
	publishedEventLowRiskPatchSchema,
	publishedEventPatchSchema,
	updateEventInputSchema,
	uuidSchema,
} from "@repo/shared/schemas";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { invalidatePublicEventCache } from "../../lib/cache-stampede.js";
import { appendEventSlugSuffix, normalizeEventSlug } from "@repo/shared/utils";
import type { FastifyBaseLogger } from "fastify";
import type { AuditLogger } from "../../lib/audit.js";
import {
	eventCacheUrls,
	sitemapCacheUrls,
} from "../../lib/cdn-invalidation.js";
import { emitEmailStub } from "../../lib/email-stub.js";
import {
	AppError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../lib/errors.js";
import { enqueueSitemapRegen } from "../../queues/sitemap-regen.js";
import { getOrganizerByUserId } from "../organizer/service.js";
import {
	type CdnPurgePayload,
	enqueueCdnPurge,
} from "../../queues/cdn-purge.js";

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
	/**
	 * Optional namespaced Redis cache client (`app.redis.cache`). When
	 * present, `invalidateEventCache` evicts the public event cache
	 * entry (I-2.4.3) after a successful publish/unpublish/admin-approve
	 * mutation. Tests omit this safely — invalidation becomes a no-op
	 * and behaviour is unchanged from the pre-2.4.3 stub.
	 */
	cache?: Redis;
	/**
	 * Optional BullMQ queue for scheduling Cloudflare CDN cache purges
	 * (I-2.4.2). When present alongside `cdnBaseUrl`,
	 * `invalidateEventCache` enqueues a fail-soft purge for the event's
	 * detail URL + `/sitemap.xml`. Fail-soft: if the queue is undefined
	 * OR `CDN_BASE_URL` is unset, no purge is scheduled and the mutation
	 * still succeeds. Tests typically omit both the queue and base URL
	 * — the existing behaviour is unchanged in that branch.
	 */
	cdnPurgeQueue?: Queue<CdnPurgePayload>;
	/** Absolute origin URL used to build CDN purge URLs. Required when `cdnPurgeQueue` is set. */
	cdnBaseUrl?: string;
	/**
	 * I-2.4.4: Optional sitemap regen queue. When present,
	 * `invalidateEventCache` enqueues a debounced regen so the public
	 * `/sitemap.xml` reflects the publish/unpublish/admin-approve
	 * within ~one cron tick. Tests omit safely — enqueue becomes a
	 * no-op when undefined.
	 */
	sitemapRegenQueue?: Queue;
}

type EventRow = typeof events.$inferSelect;
type EventCategoryRow = typeof eventCategories.$inferSelect;
type EventPricingTierRow = typeof eventPricingTiers.$inferSelect;
type EventStatusValue = EventRow["status"];
interface OrganizerPublishReadinessRow {
	id: string;
	contactEmail: string;
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
	auditLogger?: AuditLogger;
	/** See `EventPublishDeps.cache` (I-2.4.3). */
	cache?: Redis;
	/** See `EventPublishDeps.cdnPurgeQueue` (I-2.4.2). */
	cdnPurgeQueue?: Queue<CdnPurgePayload>;
	/** See `EventPublishDeps.cdnBaseUrl` (I-2.4.2). */
	cdnBaseUrl?: string;
	/** See `EventPublishDeps.sitemapRegenQueue` (I-2.4.4). */
	sitemapRegenQueue?: Queue;
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
		firstPublishedAt: row.firstPublishedAt?.toISOString() ?? null,
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

/**
 * HIGH-RISK: This count drives the admin-review trigger. Once an organizer has
 * 4 or more previously published paid events (count > 3), future paid events
 * skip review. We use `firstPublishedAt IS NOT NULL` (set once on first
 * publish, never cleared) instead of current `status` so an organizer cannot
 * republish via unpublish→draft→publish to bypass admin review.
 */
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
				sql`${events.firstPublishedAt} IS NOT NULL`,
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
	return publishedPaidEventCount <= 3;
}

function invalidateEventCache(
	deps: {
		cache?: Redis;
		cdnPurgeQueue?: Queue<CdnPurgePayload>;
		cdnBaseUrl?: string;
		sitemapRegenQueue?: Queue;
		log: Pick<FastifyBaseLogger, "info"> &
			Partial<Pick<FastifyBaseLogger, "warn" | "debug">>;
	},
	event: { slug: string },
	reason = "event_mutation",
): void {
	// I-2.4.3: Best-effort eviction of the origin Redis single-flight
	// entry. Fire-and-forget — the publish/unpublish DB transaction has
	// already committed, so a failed `DEL` must NEVER throw or block
	// the caller. The next reader will see stale data for at most one
	// `PUBLIC_EVENT_CACHE_TTL_SEC` (60s) window — same upper bound as
	// the SSR `s-maxage`. The structural log type intentionally tolerates
	// callers whose `deps.log` only declares `info` (existing publish
	// deps + dozens of test mocks); we use `warn?.(…)` so absent warn
	// is a no-op, not a runtime crash.
	if (deps.cache) {
		invalidatePublicEventCache(deps.cache, event.slug).catch((err: unknown) => {
			deps.log.warn?.(
				{ err, slug: event.slug },
				"Failed to invalidate public event cache",
			);
		});
	}

	// I-2.4.2: Cloudflare CDN purge. Purging is a separate concern from
	// origin Redis eviction — the edge serves bytes that bypass our
	// origin entirely. Enqueue the purge so the request returns fast;
	// the worker handles retries against the rate-limited Cloudflare
	// API. We always purge `/sitemap.xml` alongside the event URL since
	// publish/unpublish changes the sitemap (CDN-cached separately).
	//
	// Fail-soft layering:
	//   1. If `cdnPurgeQueue` is undefined → enqueueCdnPurge no-ops + debug-logs.
	//   2. If `cdnBaseUrl` is unset → we can't build URLs; skip silently.
	//   3. If the enqueue itself throws → enqueueCdnPurge swallows + warn-logs.
	// The publish/unpublish mutation has already committed; nothing
	// here is allowed to surface to the caller.
	if (deps.cdnPurgeQueue && deps.cdnBaseUrl) {
		const urls = [
			...eventCacheUrls(deps.cdnBaseUrl, event.slug),
			...sitemapCacheUrls(deps.cdnBaseUrl),
		];
		void enqueueCdnPurge(deps.cdnPurgeQueue, { urls, reason }, deps.log).catch(
			(err: unknown) => {
				// `enqueueCdnPurge` already swallows internally; this catch
				// is defence-in-depth in case a future change makes it throw.
				deps.log.warn?.(
					{ err, slug: event.slug, reason },
					"Failed to enqueue CDN purge job",
				);
			},
		);
	}

	// I-2.4.4: Enqueue a debounced sitemap regen. The shared `jobId`
	// inside `enqueueSitemapRegen` coalesces a burst of publish toggles
	// into one job. `enqueueSitemapRegen` no-ops when the queue is
	// undefined (tests, partial wiring). Errors must never bubble —
	// the publish/unpublish has already committed.
	const enqueueResult = enqueueSitemapRegen(deps.sitemapRegenQueue, {
		reason: "event_publish_state_changed",
	});
	if (enqueueResult) {
		enqueueResult.catch((err: unknown) => {
			deps.log.warn?.(
				{ err, slug: event.slug },
				"Failed to enqueue sitemap regen after event mutation",
			);
		});
	}
}

const PUBLISHED_HIGH_RISK_EDIT_MESSAGE =
	"High-risk fields require unpublishing the event. Unpublish first, edit in draft, then republish.";
const PUBLISHED_EVENT_LOW_RISK_FIELD_SET = new Set<string>(
	PUBLISHED_EVENT_LOW_RISK_FIELDS,
);

function getProvidedKeys(input: unknown): string[] {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		return [];
	}

	return Object.keys(input);
}

function getPublishedHighRiskFields(input: unknown): string[] {
	const providedKeys = new Set(getProvidedKeys(input));
	return PUBLISHED_EVENT_HIGH_RISK_FIELDS.filter((field) =>
		providedKeys.has(field),
	);
}

function hasOnlyPublishedLowRiskFields(input: unknown): boolean {
	const providedKeys = getProvidedKeys(input);
	if (providedKeys.length === 0) {
		return false;
	}

	return providedKeys.every((key) => PUBLISHED_EVENT_LOW_RISK_FIELD_SET.has(key));
}

function throwPublishedHighRiskEditConflict(
	highRiskFields: readonly string[] = PUBLISHED_EVENT_HIGH_RISK_FIELDS,
): never {
	throw new ConflictError(
		PUBLISHED_HIGH_RISK_EDIT_MESSAGE,
		"PUBLISHED_EVENT_HIGH_RISK_EDIT_REQUIRES_UNPUBLISH",
		{
			requiresUnpublish: true,
			highRiskFields: [...highRiskFields],
		},
	);
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
			contactEmail: organizers.contactEmail,
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
		spotsTotal: row.spotsTotal,
		spotsRemaining: row.spotsRemaining,
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

function throwInvalidEventDetails(
	error: Parameters<typeof toValidationDetails>[0],
): never {
	throw new ValidationError("Invalid event details", toValidationDetails(error));
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
	const draftValidationError = parsed.success ? undefined : parsed.error;
	const canRedirectLowRiskPayloadToPublishedPatch =
		draftValidationError !== undefined && hasOnlyPublishedLowRiskFields(input);
	if (
		draftValidationError !== undefined &&
		!canRedirectLowRiskPayloadToPublishedPatch
	) {
		throwInvalidEventDetails(draftValidationError);
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
			// HIGH-RISK: draft-only. For published events use updatePublishedEvent.
			// Wave B: tiered edit flow — only "published" has a patch endpoint.
			// Other non-draft states (under_review, completed, cancelled) are not editable.
			if (currentEvent.status === "published") {
				const highRiskFields = getPublishedHighRiskFields(input);

				if (highRiskFields.length > 0) {
					throwPublishedHighRiskEditConflict(highRiskFields);
				}

				throw new ConflictError(
					"Low-risk edits for published events must use the published patch endpoint",
					"PUBLISHED_EVENT_LOW_RISK_PATCH_REQUIRED",
				);
			}
			throw new ConflictError(
				"Event details can only be updated while the event is in draft status",
			);
		}

		if (!parsed.success) {
			// Published events reached the status branch above; draft events still
			// return the full draft PUT validation errors.
			throwInvalidEventDetails(parsed.error);
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

		if (event.status !== DEFAULT_EVENT_STATUS && event.status !== "published") {
			throw new ConflictError(
				"Event policies can only be updated while the event is in draft or published status",
			);
		}

		const data: EventPoliciesConfig = parsed.data;
		const changedFields: string[] = [];
		if (data.refundPolicy !== event.refundPolicy)
			changedFields.push("refundPolicy");
		if (data.cancellationPolicy !== event.cancellationPolicy)
			changedFields.push("cancellationPolicy");

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

		// Wave B: when editing a published event, write an audit row capturing
		// only the metadata required by the spec — no raw policy text is logged.
		if (
			event.status === "published" &&
			deps.auditLogger &&
			changedFields.length > 0
		) {
			await deps.auditLogger.log({
				actorId: userId,
				action: AUDIT_ACTIONS.EVENT_UPDATE_PUBLISHED,
				resourceType: "event",
				resourceId: parsedEventId,
				metadata: {
					organizerId: organizer.id,
					changedFields,
					transition: "policies",
				},
			});
		}

		return {
			response: toEventPoliciesResponse(updated),
			// I-2.4.2 + I-2.4.4: capture state needed for cache invalidation
			// BEFORE the transaction returns. We must purge only when the
			// change actually altered something AND the event was on the
			// public CDN — so we hand back enough context to decide outside
			// the tx.
			wasPublished: event.status === "published",
			slug: event.slug,
			changedAnything: changedFields.length > 0,
		};
	});

	// I-2.4.2 + I-2.4.4 + I-2.4.3: invalidate caches AFTER tx commit so a
	// CDN purge / sitemap regen is never scheduled for a rolled-back
	// update. `invalidateEventCache` runs Redis DEL + CDN purge enqueue +
	// sitemap regen enqueue, all best-effort.
	if (policies.wasPublished && policies.changedAnything) {
		invalidateEventCache(
			deps,
			{ slug: policies.slug },
			"event_policies_update",
		);
	}

	deps.log.info(
		{
			eventId: parsedEventId,
			organizerId: organizer.id,
			userId,
		},
		"Event policies updated",
	);

	return policies.response;
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
		// HIGH-RISK: firstPublishedAt is set ONCE on first transition to published
		// and is never overwritten or cleared. Used by getPublishedPaidEventCount
		// to drive admin-review gating; a second publish/unpublish cycle MUST keep
		// the original timestamp so review-skip behaviour remains consistent.
		const [updated] = await tx
			.update(events)
			.set({
				status:
					transition === "draft_to_under_review" ? "under_review" : "published",
				publishedAt: transition === "draft_to_published" ? now : null,
				firstPublishedAt:
					transition === "draft_to_published"
						? sql`COALESCE(${events.firstPublishedAt}, ${now})`
						: events.firstPublishedAt,
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
		return { event: responseEvent, transition, readiness, organizer };
	});

	// I-2.4.2 fix: invalidate caches AFTER tx commit so a CDN purge is
	// never scheduled for a rolled-back publish (e.g. constraint violation
	// in a later step or audit-log failure inside the tx). Mirrors the
	// `updateEventPolicies` and `adminRejectEvent` pattern.
	invalidateEventCache(deps, result.event, "event_publish");

	deps.log.info(
		{
			eventId,
			userId,
			transition: result.transition,
		},
		"Event publish workflow completed",
	);

	// Wave B: log-only email stub. Failures must NEVER break the publish flow.
	if (result.transition === "draft_to_under_review") {
		try {
			emitEmailStub(
				{ log: deps.log },
				{
					jobName: EMAIL_JOB_NAMES.EVENT_REVIEW_SUBMITTED,
					idempotencyKey: buildEmailIdempotencyKey.eventReviewSubmitted(
						result.event.id,
						new Date(result.event.submittedForReviewAt ?? Date.now()),
					),
					context: {
						eventId: result.event.id,
						organizerId: result.event.organizerId,
					},
				},
			);
		} catch (emailError) {
			deps.log.info(
				{
					err: String(emailError),
					eventId: result.event.id,
					emailStubFailed: true,
				},
				"event.review_submitted email stub failed (non-fatal)",
			);
		}
	}

	return {
		event: result.event,
		transition: result.transition,
		readiness: result.readiness,
	};
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
		return {
			event: responseEvent,
			transition: "published_to_draft" as const,
		};
	});

	// I-2.4.2 fix: invalidate caches AFTER tx commit so a CDN purge is
	// never scheduled for a rolled-back unpublish.
	invalidateEventCache(deps, result.event, "event_unpublish");

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
				// HIGH-RISK: see publishEvent — never overwrite once set.
				firstPublishedAt: sql`COALESCE(${events.firstPublishedAt}, ${now})`,
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
		return {
			event: responseEvent,
			transition: "under_review_to_published" as const,
			readiness,
			organizer,
		};
	});

	// I-2.4.2 fix: invalidate caches AFTER tx commit so a CDN purge is
	// never scheduled for a rolled-back admin approval.
	invalidateEventCache(deps, result.event, "admin_approve_publish");

	// Wave B: log-only email stub. Failures must NEVER break admin approval.
	try {
		emitEmailStub(
			{ log: deps.log },
			{
				jobName: EMAIL_JOB_NAMES.EVENT_REVIEW_APPROVED,
				idempotencyKey: buildEmailIdempotencyKey.eventReviewApproved(
					result.event.id,
					new Date(result.event.publishedAt ?? Date.now()),
				),
				context: {
					eventId: result.event.id,
					organizerId: result.event.organizerId,
				},
			},
		);
	} catch (emailError) {
		deps.log.info(
			{
				err: String(emailError),
				eventId: result.event.id,
				emailStubFailed: true,
			},
			"event.admin_approved email stub failed (non-fatal)",
		);
	}

	return {
		event: result.event,
		transition: result.transition,
		readiness: result.readiness,
	};
}

export async function adminRejectEvent(
	deps: EventPublishDeps,
	eventId: string,
	adminUserId: string,
	reason?: string,
	ipAddress?: string,
): Promise<UnpublishEventResult> {
	const parsedEventId = parseUuid(eventId, "event id");
	const result = await deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});
		if (event.status !== "under_review") {
			throw new ConflictError("Only events under review can be rejected");
		}
		const organizer = await selectOrganizerForPublishReadiness(
			tx as unknown as Database,
			event.organizerId,
		);
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
			organizerEmail: organizer?.contactEmail ?? null,
		};
	});

	// I-2.4.2: defense-in-depth purge for the rejected event. The
	// `under_review → draft` transition usually affects an event that
	// was never on the public CDN, BUT a re-submitted event could have
	// been previously published — in that case a stale 200 at the edge
	// after rejection would be misleading. Cheap to purge unconditionally
	// (one URL + sitemap), and the worker is rate-limit aware.
	invalidateEventCache(deps, result.event, "admin_reject_unpublish");

	// Wave B: log-only email stub. Failures must NEVER break admin rejection.
	if (result.organizerEmail) {
		try {
			emitEmailStub(
				{ log: deps.log },
				{
					jobName: EMAIL_JOB_NAMES.EVENT_REVIEW_REJECTED,
					idempotencyKey: buildEmailIdempotencyKey.eventReviewRejected(
						result.event.id,
						new Date(result.event.updatedAt),
					),
					context: {
						eventId: result.event.id,
						organizerId: result.event.organizerId,
					},
				},
			);
		} catch (emailError) {
			deps.log.info(
				{
					err: String(emailError),
					eventId: result.event.id,
					emailStubFailed: true,
				},
				"event.admin_rejected email stub failed (non-fatal)",
			);
		}
	}

	return {
		event: result.event,
		transition: result.transition,
	};
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

export interface UpdatePublishedEventDeps {
	db: EventCategoryTransactionalStore;
	log: Pick<FastifyBaseLogger, "info">;
	auditLogger: AuditLogger;
	/** See `EventPublishDeps.cache` (I-2.4.3). */
	cache?: Redis;
	/** See `EventPublishDeps.cdnPurgeQueue` (I-2.4.2). */
	cdnPurgeQueue?: Queue<CdnPurgePayload>;
	/** See `EventPublishDeps.cdnBaseUrl` (I-2.4.2). */
	cdnBaseUrl?: string;
	/** I-2.4.4: see `EventPublishDeps.sitemapRegenQueue`. */
	sitemapRegenQueue?: Queue;
}

/**
 * Wave B: tiered post-publish edits — narrow PATCH endpoint.
 * Only the fields whitelisted by `publishedEventPatchSchema` may change. Every
 * call writes an EVENT_UPDATE_PUBLISHED audit row with the changed-field list
 * (no raw policy text is stored, per the audit metadata constraint).
 */
export async function updatePublishedEvent(
	deps: UpdatePublishedEventDeps,
	userId: string,
	eventId: string,
	input: unknown,
): Promise<Event> {
	const parsedEventId = parseUuid(eventId, "event id");
	const parsed = publishedEventPatchSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid published event patch",
			toValidationDetails(parsed.error),
		);
	}

	const organizer = await getOrganizerByUserId(deps.db as Database, userId);
	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const result = await deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});

		if (event.organizerId !== organizer.id) {
			throw new ForbiddenError("You do not have access to this event");
		}

		if (event.status !== "published") {
			throw new ConflictError(
				"This endpoint can only be used while the event is published",
			);
		}

		// Authorization confirmed; only now reject high-risk payloads so that
		// non-owners cannot probe arbitrary event ids via the structured 409.
		const highRiskFields = getPublishedHighRiskFields(parsed.data);
		if (highRiskFields.length > 0) {
			throwPublishedHighRiskEditConflict(highRiskFields);
		}

		const lowRiskPatch = Object.fromEntries(
			PUBLISHED_EVENT_LOW_RISK_FIELDS.filter(
				(field) => field in parsed.data,
			).map((field) => [field, parsed.data[field]]),
		);
		const lowRiskParsed =
			publishedEventLowRiskPatchSchema.safeParse(lowRiskPatch);
		if (!lowRiskParsed.success) {
			throw new ValidationError(
				"Invalid published event patch",
				toValidationDetails(lowRiskParsed.error),
			);
		}

		const data = lowRiskParsed.data;

		const updateFields: Record<string, unknown> = { updatedAt: new Date() };
		const changedFields: string[] = [];

		if (
			data.description !== undefined &&
			data.description !== event.description
		) {
			updateFields.description = data.description;
			changedFields.push("description");
		}
		if (
			data.routeDetails !== undefined &&
			data.routeDetails !== event.routeDetails
		) {
			updateFields.routeDetails = data.routeDetails;
			changedFields.push("routeDetails");
		}
		if (
			data.refundPolicy !== undefined &&
			data.refundPolicy !== event.refundPolicy
		) {
			updateFields.refundPolicy = data.refundPolicy;
			changedFields.push("refundPolicy");
		}
		if (
			data.cancellationPolicy !== undefined &&
			data.cancellationPolicy !== event.cancellationPolicy
		) {
			updateFields.cancellationPolicy = data.cancellationPolicy;
			changedFields.push("cancellationPolicy");
		}

		if (changedFields.length === 0) {
			return toEventResponse(event);
		}

		const [updated] = await tx
			.update(events)
			.set(updateFields)
			.where(and(eq(events.id, parsedEventId), eq(events.status, "published")))
			.returning();

		if (!updated) {
			throw new ConflictError(
				"Event status changed during update. Please retry.",
			);
		}

		await deps.auditLogger.log({
			actorId: userId,
			actorRole: "organizer",
			action: AUDIT_ACTIONS.EVENT_UPDATE_PUBLISHED,
			resourceType: "event",
			resourceId: parsedEventId,
			metadata: {
				organizerId: organizer.id,
				changedFields,
				transition: "published_patch",
			},
		});

		const responseEvent = toEventResponse(updated);
		return responseEvent;
	});

	// I-2.4.2 fix: invalidate caches AFTER tx commit so a CDN purge is
	// never scheduled for a rolled-back published-event patch.
	invalidateEventCache(deps, result, "published_event_patch");

	deps.log.info(
		{ eventId: parsedEventId, organizerId: organizer.id, userId },
		"Published event patched",
	);

	return result;
}

/**
 * Wave B: update an event category's capacity. Only allowed while the parent
 * event is in draft. `spotsRemaining` is clamped to `spotsTotal` by both
 * application logic and the underlying CHECK constraint.
 */
export async function updateEventCategoryCapacity(
	deps: EventCategoryDeps,
	userId: string,
	eventId: string,
	categoryId: string,
	input: unknown,
): Promise<EventCategoryRecord> {
	const parsedEventId = parseUuid(eventId, "event id");
	const parsedCategoryId = parseUuid(categoryId, "category id");
	const parsed = eventCategoryCapacityUpdateSchema.safeParse(input);
	if (!parsed.success) {
		throw new ValidationError(
			"Invalid event category capacity",
			toValidationDetails(parsed.error),
		);
	}

	const organizer = await getOrganizerByUserId(deps.db as Database, userId);
	if (!organizer) {
		throw new NotFoundError(
			"Organizer profile not found. Please register first.",
		);
	}

	const result = await deps.db.transaction(async (tx) => {
		const event = await selectEventForCategories(tx, parsedEventId, {
			forUpdate: true,
		});

		if (event.organizerId !== organizer.id) {
			throw new ForbiddenError("You do not have access to this event");
		}

		if (event.status !== DEFAULT_EVENT_STATUS) {
			throw new ConflictError(
				"Event category capacity can only be updated while the event is in draft status",
			);
		}

		const [category] = await tx
			.select()
			.from(eventCategories)
			.where(
				and(
					eq(eventCategories.id, parsedCategoryId),
					eq(eventCategories.eventId, parsedEventId),
				),
			)
			.limit(1);

		if (!category) {
			throw new NotFoundError("Event category not found");
		}

		const nextTotal = parsed.data.spotsTotal ?? category.spotsTotal;
		const nextRemaining =
			parsed.data.spotsRemaining ??
			Math.min(category.spotsRemaining, nextTotal);

		if (nextRemaining > nextTotal) {
			throw new ValidationError("spotsRemaining cannot exceed spotsTotal", {
				field: "spotsRemaining",
			});
		}

		const [updated] = await tx
			.update(eventCategories)
			.set({
				spotsTotal: nextTotal,
				spotsRemaining: nextRemaining,
				updatedAt: new Date(),
			})
			.where(eq(eventCategories.id, parsedCategoryId))
			.returning();

		if (!updated) {
			throw new ConflictError(
				"Event category changed during update. Please retry.",
			);
		}

		return toEventCategoryResponse(updated);
	});

	deps.log.info(
		{
			eventId: parsedEventId,
			categoryId: parsedCategoryId,
			organizerId: organizer.id,
			userId,
		},
		"Event category capacity updated",
	);

	return result;
}
