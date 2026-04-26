import type { Event, EventCategoryRecord } from "@repo/shared/schemas";

export type { Event, EventCategoryRecord };

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
