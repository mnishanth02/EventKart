import type {
	EventPublicCategory,
	EventPublicImage,
	EventPublicPricingTier,
} from "@repo/shared/schemas";

/**
 * Narrow projection consumed by `<PublicEventCard>`. Listing/profile endpoints
 * must include at minimum these fields. A separate shared zod schema can be
 * introduced in I-2.2.1 if the API needs runtime validation.
 */
export interface EventCardData {
	slug: string;
	title: string;
	startAt: string;
	endAt: string;
	timezone: string;
	city: string;
	venueName: string;
	registrationOpensAt: string | null;
	registrationClosesAt: string | null;
	isPaid: boolean;
	heroImage: EventPublicImage | null;
	categories: ReadonlyArray<
		Pick<EventPublicCategory, "name" | "slug" | "distanceMeters" | "capacity">
	>;
	pricingTiers: ReadonlyArray<
		Pick<
			EventPublicPricingTier,
			| "categorySlug"
			| "basePrice"
			| "earlyBirdPrice"
			| "earlyBirdDeadline"
			| "currency"
		>
	>;
}
