import { describe, expect, it } from "vitest";
import { Route } from "./index";

type SearchInput = Record<string, unknown>;

function validateSearch(input: SearchInput) {
	const validate = Route.options.validateSearch as
		| { parse: (input: SearchInput) => Record<string, unknown> }
		| ((input: SearchInput) => Record<string, unknown>);

	return typeof validate === "function"
		? validate(input)
		: validate.parse(input);
}

function loaderDeps(search: SearchInput) {
	const getDeps = Route.options.loaderDeps as unknown as (args: {
		search: SearchInput;
	}) => Record<string, unknown>;
	return getDeps({ search });
}

describe("/_public route search params", () => {
	it("defaults event-list search state", () => {
		const search = validateSearch({});

		expect(search).toMatchObject({ page: 1, sort: "startAtAsc" });
		expect(loaderDeps(search)).toEqual({ page: 1, sort: "startAtAsc" });
	});

	it("narrows valid page and sort params", () => {
		const search = validateSearch({ page: "2", sort: "startAtDesc" });

		expect(search).toMatchObject({ page: 2, sort: "startAtDesc" });
		expect(loaderDeps(search)).toEqual({ page: 2, sort: "startAtDesc" });
	});

	it("keeps auth redirect search outside loader deps", () => {
		const search = validateSearch({
			reason: "auth-required",
			redirect: "/foo",
		});

		expect(search).toMatchObject({
			page: 1,
			sort: "startAtAsc",
			reason: "auth-required",
			redirect: "/foo",
		});
		expect(loaderDeps(search)).toEqual({ page: 1, sort: "startAtAsc" });
	});

	it("falls back for invalid page and sort input", () => {
		const search = validateSearch({ page: "-1", sort: "hax" });

		expect(search).toMatchObject({ page: 1, sort: "startAtAsc" });
		expect(loaderDeps(search)).toEqual({ page: 1, sort: "startAtAsc" });
	});
});
