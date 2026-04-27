import type {
	Event,
	EventCategoryRecord,
	EventImage,
	EventImageKind,
	EventImageListQuery,
	EventImageStatus,
	EventImageUploadUrlRequest,
	EventImageUploadUrlResponse,
	EventPoliciesConfig,
	EventPoliciesRecord,
	EventPricingConfig,
	EventPricingTierWithCategory,
	PublishReadiness,
	PublishEventResponse,
	UnpublishEventResponse,
} from "@repo/shared/schemas";

export type {
	Event,
	EventCategoryRecord,
	EventImage,
	EventImageKind,
	EventImageListQuery,
	EventImageStatus,
	EventImageUploadUrlRequest,
	EventImageUploadUrlResponse,
	EventPoliciesConfig,
	EventPoliciesRecord,
	EventPricingConfig,
	EventPricingTierWithCategory,
	PublishEventResponse,
	PublishReadiness,
	UnpublishEventResponse,
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

export type EventImagesResponse = {
	success: true;
	data: {
		images: EventImage[];
	};
};

export type EventImageUploadUrlApiResponse = {
	success: true;
	data: EventImageUploadUrlResponse;
};

export type EventImageConfirmResponse = {
	success: true;
	data: EventImage;
};

export type EventImageDeleteResponse = {
	success: true;
	data: {
		deleted: true;
		imageId: string;
		kind: EventImageKind;
	};
};

export type PublishReadinessResponse = {
	success: true;
	data: PublishReadiness;
};
