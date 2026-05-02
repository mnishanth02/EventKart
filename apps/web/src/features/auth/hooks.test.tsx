import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthActions } from "./hooks";
import { AUTH_QUERY_KEY } from "./queries";

function buildQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("useAuthActions", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("clears the cached session immediately and cancels in-flight auth queries", () => {
		const queryClient = buildQueryClient();
		queryClient.setQueryData(AUTH_QUERY_KEY, {
			userId: "00000000-0000-4000-8000-000000000001",
			role: "organizer",
		});
		const cancelSpy = vi.spyOn(queryClient, "cancelQueries");

		const { result } = renderHook(() => useAuthActions(), {
			wrapper: createWrapper(queryClient),
		});

		act(() => {
			result.current.clearSession();
		});

		expect(cancelSpy).toHaveBeenCalledWith({ queryKey: AUTH_QUERY_KEY });
		expect(queryClient.getQueryData(AUTH_QUERY_KEY)).toBeNull();
	});
});
