import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { useNow } from "./use-now";

describe("useNow", () => {
	it("returns null on the initial jsdom render before effects commit", () => {
		const observed: Array<Date | null> = [];

		renderHook(() => {
			const now = useNow();
			observed.push(now);
			return now;
		});

		expect(observed[0]).toBeNull();
	});

	it("returns a Date after the effect fires", async () => {
		const fixedNow = new Date("2026-07-01T03:30:00.000Z");
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(fixedNow);

		const { result, unmount } = renderHook(() => useNow());

		await waitFor(() => {
			expect(result.current).toEqual(fixedNow);
		});

		unmount();
		vi.useRealTimers();
	});

	it("does not re-render periodically because it uses no interval", () => {
		const fixedNow = new Date("2026-07-01T03:30:00.000Z");
		vi.useFakeTimers();
		vi.setSystemTime(fixedNow);
		const observed: Array<Date | null> = [];

		const { result, unmount } = renderHook(() => {
			const now = useNow();
			observed.push(now);
			return now;
		});

		expect(result.current).toEqual(fixedNow);

		act(() => {
			vi.advanceTimersByTime(60_000);
		});

		expect(result.current).toEqual(fixedNow);
		expect(observed).toHaveLength(2);

		unmount();
		vi.useRealTimers();
	});
});
