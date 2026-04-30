import { describe, expect, it } from "vitest";
import {
	PUBLIC_EVENTS_LIST_DEFAULT_PAGE,
	PUBLIC_EVENTS_LIST_DEFAULT_SORT,
	publicEventsListSearchSchema,
} from "./search-params";

describe("publicEventsListSearchSchema", () => {
	it("uses defaults when search params are absent", () => {
		expect(publicEventsListSearchSchema.parse({})).toEqual({
			page: PUBLIC_EVENTS_LIST_DEFAULT_PAGE,
			sort: PUBLIC_EVENTS_LIST_DEFAULT_SORT,
		});
	});

	it("coerces a valid page string and accepts descending sort", () => {
		expect(
			publicEventsListSearchSchema.parse({
				page: "3",
				sort: "startAtDesc",
			}),
		).toEqual({
			page: 3,
			sort: "startAtDesc",
		});
	});

	it.each([
		[{ page: "banana" }, { page: 1, sort: "startAtAsc" }],
		[{ page: "0" }, { page: 1, sort: "startAtAsc" }],
		[{ page: "-1" }, { page: 1, sort: "startAtAsc" }],
		[{ sort: "hax" }, { page: 1, sort: "startAtAsc" }],
	])("falls back for invalid input %j", (input, expected) => {
		expect(publicEventsListSearchSchema.parse(input)).toEqual(expected);
	});
});
