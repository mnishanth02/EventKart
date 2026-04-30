import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { resolvePublicEventsListLoader } from "./loader";

const params = { page: 1, limit: 20, sort: "startAtAsc" as const };
const payload = {
	data: [],
	meta: {
		page: 1,
		limit: 20,
		total: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false,
	},
};

function queryClientReturning(value: typeof payload): QueryClient {
	return {
		ensureQueryData: vi.fn().mockResolvedValue(value),
	} as unknown as QueryClient;
}

function queryClientRejecting(error: unknown): QueryClient {
	return {
		ensureQueryData: vi.fn().mockRejectedValue(error),
	} as unknown as QueryClient;
}

describe("resolvePublicEventsListLoader", () => {
	it("calls ensureQueryData with public list query options", async () => {
		const queryClient = queryClientReturning(payload);

		await resolvePublicEventsListLoader({ queryClient, params });

		expect(queryClient.ensureQueryData).toHaveBeenCalledWith(
			expect.objectContaining({
				queryKey: ["public-events", "list", params],
			}),
		);
	});

	it("sets CDN cache headers via the injected SSR header sink", async () => {
		const setResponseHeaders = vi.fn();

		const result = await resolvePublicEventsListLoader({
			queryClient: queryClientReturning(payload),
			setResponseHeaders,
			params,
		});

		expect(result).toEqual({ events: [], meta: payload.meta });
		expect(setResponseHeaders).toHaveBeenCalledOnce();
		const headers = setResponseHeaders.mock.calls[0]?.[0] as Headers;
		expect(headers.get("Cache-Control")).toBe(
			"public, s-maxage=60, stale-while-revalidate=300",
		);
	});

	it("propagates query errors", async () => {
		const error = new Error("API unavailable");

		await expect(
			resolvePublicEventsListLoader({
				queryClient: queryClientRejecting(error),
				params,
			}),
		).rejects.toBe(error);
	});
});
