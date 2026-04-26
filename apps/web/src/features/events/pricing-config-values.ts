import type {
	EventCategoryRecord,
	EventPricingConfigInput,
	EventPricingTierWithCategory,
} from "@repo/shared/schemas";

export const DEFAULT_EVENT_BASE_PRICE = 75_000;

export function eventPricingRecordsToConfigValues(
	categories: readonly EventCategoryRecord[],
	tiers: readonly EventPricingTierWithCategory[] | null | undefined,
): EventPricingConfigInput {
	const tierByCategoryId = new Map(
		(tiers ?? []).map((tier) => [tier.eventCategoryId, tier] as const),
	);

	return {
		tiers: [...categories]
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((category) => {
				const tier = tierByCategoryId.get(category.id);
				return {
					eventCategoryId: category.id,
					basePrice: tier?.basePrice ?? DEFAULT_EVENT_BASE_PRICE,
					earlyBirdPrice: tier?.earlyBirdPrice ?? null,
					earlyBirdDeadline: tier?.earlyBirdDeadline ?? null,
				};
			}),
	};
}
