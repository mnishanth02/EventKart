import { z } from "zod/v4";

export const EVENT_STATUSES = [
	"draft",
	"under_review",
	"published",
	"completed",
	"cancelled",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const eventStatusSchema = z.enum(EVENT_STATUSES);

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
	draft: "Draft",
	under_review: "Under Review",
	published: "Published",
	completed: "Completed",
	cancelled: "Cancelled",
} as const;

export const EVENT_TYPES = ["race"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const eventTypeSchema = z.enum(EVENT_TYPES);

export const EVENT_SPORTS = ["running"] as const;
export type EventSport = (typeof EVENT_SPORTS)[number];
export const eventSportSchema = z.enum(EVENT_SPORTS);

export const EVENT_CATEGORIES = ["running"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export const eventCategorySchema = z.enum(EVENT_CATEGORIES);

export const EVENT_CURRENCIES = ["INR"] as const;
export type EventCurrency = (typeof EVENT_CURRENCIES)[number];
export const eventCurrencySchema = z.enum(EVENT_CURRENCIES);

export const EVENT_DISTANCE_CATEGORY_PRESETS = [
	{ slug: "5k", label: "5K", distanceMeters: 5000 },
	{ slug: "10k", label: "10K", distanceMeters: 10000 },
	{
		slug: "half-marathon",
		label: "Half Marathon",
		distanceMeters: 21098,
	},
] as const;

export type EventDistanceCategoryPreset =
	(typeof EVENT_DISTANCE_CATEGORY_PRESETS)[number];

export const EVENT_DISTANCE_CATEGORY_SLUGS =
	EVENT_DISTANCE_CATEGORY_PRESETS.map((preset) => preset.slug) as [
		EventDistanceCategoryPreset["slug"],
		...EventDistanceCategoryPreset["slug"][],
	];

export type EventDistanceCategorySlug =
	(typeof EVENT_DISTANCE_CATEGORY_SLUGS)[number];

export const eventDistanceCategorySlugSchema = z.enum(
	EVENT_DISTANCE_CATEGORY_SLUGS,
);

export const EVENT_DISTANCE_CATEGORY_NAME_MAX_LENGTH = 80;
export const EVENT_DISTANCE_CATEGORY_SLUG_MAX_LENGTH = 80;
export const EVENT_DISTANCE_CATEGORY_MIN_DISTANCE_METERS = 1;
export const EVENT_DISTANCE_CATEGORY_MAX_DISTANCE_METERS = 100_000;
export const EVENT_DISTANCE_CATEGORY_MAX_SORT_ORDER = 100;
export const EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT = 10;
export const EVENT_CATEGORY_DEFAULT_SPOTS = 100;
export const EVENT_CATEGORY_MIN_SPOTS = 1;
export const EVENT_PRICING_MIN_PRICE_PAISE = 100;
export const EVENT_PRICING_MAX_PRICE_PAISE = 10_000_000;
export const EVENT_PRICE_MIN_INR = EVENT_PRICING_MIN_PRICE_PAISE / 100;
export const EVENT_PRICE_MAX_INR = EVENT_PRICING_MAX_PRICE_PAISE / 100;
export const EVENT_POLICY_MAX_LENGTH = 2000;

export const PUBLISHED_EVENT_LOW_RISK_FIELDS = [
	"description",
	"routeDetails",
	"refundPolicy",
	"cancellationPolicy",
] as const;

export const PUBLISHED_EVENT_HIGH_RISK_FIELDS = [
	"title",
	"eventType",
	"sport",
	"category",
	"venueName",
	"addressLine1",
	"addressLine2",
	"city",
	"state",
	"country",
	"postalCode",
	"timezone",
	"startAt",
	"endAt",
	"registrationOpensAt",
	"registrationClosesAt",
	"isPaid",
	"currency",
	"categories",
	"pricingTiers",
	"registrationFormSchema",
	"formSchema",
] as const;

export type PublishedEventLowRiskField =
	(typeof PUBLISHED_EVENT_LOW_RISK_FIELDS)[number];
export type PublishedEventHighRiskField =
	(typeof PUBLISHED_EVENT_HIGH_RISK_FIELDS)[number];

export const EVENT_IMAGE_KINDS = ["hero", "route_map"] as const;
export type EventImageKind = (typeof EVENT_IMAGE_KINDS)[number];
export const eventImageKindSchema = z.enum(EVENT_IMAGE_KINDS);

export const EVENT_IMAGE_STATUSES = [
	"pending",
	"uploaded",
	"replaced",
	"deleted",
] as const;
export type EventImageStatus = (typeof EVENT_IMAGE_STATUSES)[number];
export const eventImageStatusSchema = z.enum(EVENT_IMAGE_STATUSES);

export const EVENT_IMAGE_ALLOWED_CONTENT_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;
export type EventImageContentType =
	(typeof EVENT_IMAGE_ALLOWED_CONTENT_TYPES)[number];
export const eventImageContentTypeSchema = z.enum(
	EVENT_IMAGE_ALLOWED_CONTENT_TYPES,
);

export const EVENT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const V1_EVENT_TYPE = "race" satisfies EventType;
export const V1_EVENT_SPORT = "running" satisfies EventSport;
export const V1_EVENT_CATEGORY = "running" satisfies EventCategory;
export const V1_EVENT_CITY = "Coimbatore";
export const V1_EVENT_STATE = "Tamil Nadu";
export const V1_EVENT_COUNTRY = "India";
export const V1_EVENT_TIMEZONE = "Asia/Kolkata";
export const V1_EVENT_IS_PAID = true;
export const V1_EVENT_CURRENCY = "INR" satisfies EventCurrency;
export const DEFAULT_EVENT_STATUS = "draft" satisfies EventStatus;

export const V1_EVENT_ALLOWED_VALUES = {
	category: V1_EVENT_CATEGORY,
	city: V1_EVENT_CITY,
	country: V1_EVENT_COUNTRY,
	currency: V1_EVENT_CURRENCY,
	eventType: V1_EVENT_TYPE,
	isPaid: V1_EVENT_IS_PAID,
	sport: V1_EVENT_SPORT,
	state: V1_EVENT_STATE,
	timezone: V1_EVENT_TIMEZONE,
} as const;
