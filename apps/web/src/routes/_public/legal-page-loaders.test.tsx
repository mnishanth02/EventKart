import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const pendingHeaderCalls: Array<{ resolve: () => void }> = [];
	const routeOptionsByPath = new Map<
		string,
		{ loader?: () => Promise<unknown>; ssr?: boolean }
	>();

	const setLegalPageCacheHeaders = vi.fn(() => {
		let resolve!: () => void;
		const promise = new Promise<void>((done) => {
			resolve = done;
		});
		pendingHeaderCalls.push({ resolve });
		return promise;
	});

	return {
		pendingHeaderCalls,
		routeOptionsByPath,
		setLegalPageCacheHeaders,
	};
});

vi.mock("@tanstack/react-router", () => ({
	createFileRoute:
		(path: string) =>
		(options: { loader?: () => Promise<unknown>; ssr?: boolean }) => {
			mocks.routeOptionsByPath.set(path, options);
			return {
				options,
				useLoaderData: () => ({
					siteUrl: "https://eventkart.in",
					supportPhone: "+91 80000 00000",
				}),
			};
		},
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("#/features/legal-pages/cache-headers", () => ({
	LEGAL_PAGE_CACHE_CONTROL:
		"public, s-maxage=3600, stale-while-revalidate=86400",
	setLegalPageCacheHeaders: mocks.setLegalPageCacheHeaders,
}));

vi.mock("#/lib/env/public", () => ({
	publicEnv: {
		VITE_PUBLIC_SUPPORT_PHONE: "+91 80000 00000",
		VITE_SITE_URL: "https://eventkart.in",
	},
}));

await import("./about");
await import("./contact");
await import("./faq");
await import("./privacy");
await import("./terms");

const LEGAL_ROUTE_PATHS = [
	"/_public/about",
	"/_public/contact",
	"/_public/faq",
	"/_public/privacy",
	"/_public/terms",
] as const;

async function flushMicrotasks() {
	await Promise.resolve();
	await Promise.resolve();
}

async function waitForPendingHeaderCall() {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const headerCall = mocks.pendingHeaderCalls[0];
		if (headerCall) return headerCall;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	throw new Error("Expected loader to call setLegalPageCacheHeaders");
}

describe("Module 2.5 legal page route loaders", () => {
	beforeEach(() => {
		mocks.pendingHeaderCalls.length = 0;
		mocks.setLegalPageCacheHeaders.mockClear();
	});

	it.each(LEGAL_ROUTE_PATHS)("%s is SSR-enabled", (path) => {
		const options = mocks.routeOptionsByPath.get(path);
		expect(options?.ssr).toBe(true);
	});

	it.each(
		LEGAL_ROUTE_PATHS,
	)("%s waits for cache headers before resolving loader data", async (path) => {
		const options = mocks.routeOptionsByPath.get(path);
		expect(options?.loader).toBeTypeOf("function");
		if (!options?.loader) return;

		const loaderPromise = options.loader();
		let loaderResolved = false;
		void loaderPromise.then(() => {
			loaderResolved = true;
		});

		const headerCall = await waitForPendingHeaderCall();
		await flushMicrotasks();

		expect(mocks.setLegalPageCacheHeaders).toHaveBeenCalledOnce();
		expect(loaderResolved).toBe(false);
		headerCall.resolve();

		await expect(loaderPromise).resolves.toEqual(
			expect.objectContaining({ siteUrl: "https://eventkart.in" }),
		);
		expect(loaderResolved).toBe(true);
	});
});
