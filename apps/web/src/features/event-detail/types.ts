import type {
	EventPublicCategory,
	EventPublicDetail,
	EventPublicImage,
	EventPublicLookupResponse,
	EventPublicOrganizerSummary,
	EventPublicPricingTier,
	EventPublicSlugRedirect,
} from "@repo/shared/schemas";

export type {
	EventPublicCategory,
	EventPublicDetail,
	EventPublicImage,
	EventPublicLookupResponse,
	EventPublicOrganizerSummary,
	EventPublicPricingTier,
	EventPublicSlugRedirect,
};

export type EventPublicLookupApiEnvelope = {
	success: true;
	data: EventPublicLookupResponse;
};
