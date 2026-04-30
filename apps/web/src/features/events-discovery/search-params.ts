import { z } from "zod/v4";

export const PUBLIC_EVENTS_LIST_SORT_VALUES = [
	"startAtAsc",
	"startAtDesc",
] as const;
export type PublicEventsListSort =
	(typeof PUBLIC_EVENTS_LIST_SORT_VALUES)[number];

export const PUBLIC_EVENTS_LIST_DEFAULT_SORT: PublicEventsListSort =
	"startAtAsc";
export const PUBLIC_EVENTS_LIST_DEFAULT_PAGE = 1;
export const PUBLIC_EVENTS_LIST_LIMIT = 20;

export const publicEventsListSearchSchema = z.object({
	page: z.coerce
		.number()
		.int()
		.min(1)
		.default(PUBLIC_EVENTS_LIST_DEFAULT_PAGE)
		.catch(PUBLIC_EVENTS_LIST_DEFAULT_PAGE),
	sort: z
		.enum(PUBLIC_EVENTS_LIST_SORT_VALUES)
		.default(PUBLIC_EVENTS_LIST_DEFAULT_SORT)
		.catch(PUBLIC_EVENTS_LIST_DEFAULT_SORT),
});

export const PUBLIC_EVENTS_LIST_SORT_LABELS: Record<
	PublicEventsListSort,
	string
> = {
	startAtAsc: "Upcoming first",
	startAtDesc: "Latest first",
};
