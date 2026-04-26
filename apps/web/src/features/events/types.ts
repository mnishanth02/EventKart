import type { Event } from "@repo/shared/schemas";

export type { Event };

export type EventResponse = {
	success: true;
	data: Event;
};
