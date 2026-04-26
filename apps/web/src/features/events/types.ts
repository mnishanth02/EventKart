import type {
	Event,
	EventCategoryRecord,
	EventPoliciesConfig,
	EventPoliciesRecord,
	EventPricingConfig,
	EventPricingTierWithCategory,
} from "@repo/shared/schemas";

export type {
	Event,
	EventCategoryRecord,
	EventPoliciesConfig,
	EventPoliciesRecord,
	EventPricingConfig,
	EventPricingTierWithCategory,
};

export type EventResponse = {
	success: true;
	data: Event;
};

export type EventCategoriesResponse = {
	success: true;
	data: {
		categories: EventCategoryRecord[];
	};
};

export type EventPricingResponse = {
	success: true;
	data: {
		tiers: EventPricingTierWithCategory[];
	};
};

export type EventPoliciesResponse = {
	success: true;
	data: EventPoliciesRecord;
};
