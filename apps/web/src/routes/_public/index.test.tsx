import type { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
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

async function runLoader({
	page,
	total,
	totalPages,
}: {
	page: number;
	total: number;
	totalPages: number;
}) {
	const loader = Route.options.loader as unknown as (args: {
		context: { queryClient: QueryClient };
		deps: { page: number; sort: "startAtAsc" };
	}) => Promise<unknown>;
	const queryClient = {
		ensureQueryData: vi.fn().mockResolvedValue({
			data: [],
			meta: {
				page,
				limit: 20,
				total,
				totalPages,
				hasNext: false,
				hasPrev: page > 1,
			},
		}),
	} as unknown as QueryClient;

	return loader({
		context: { queryClient },
		deps: { page, sort: "startAtAsc" },
	});
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

	it("redirects empty out-of-range event-list pages back to page 1", async () => {
		try {
			await runLoader({ page: 999, total: 0, totalPages: 0 });
			expect.unreachable("Expected redirect to be thrown");
		} catch (error) {
			expect(isRedirect(error)).toBe(true);
			const redirectError = error as Response & {
				options: { to: string; search: (prev: SearchInput) => SearchInput };
			};
			expect(redirectError.options.to).toBe("/");
			expect(redirectError.options.search({ sort: "startAtAsc" })).toEqual({
				sort: "startAtAsc",
				page: 1,
			});
		}
	});
});
