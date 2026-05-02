import "./integrations/sentry/server";

import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { PUBLIC_EVENT_CACHE_CONTROL } from "#/features/event-detail/cache-headers";
import { LEGAL_PAGE_CACHE_CONTROL } from "#/features/legal-pages/cache-headers";
import { ORGANIZER_DETAIL_CACHE_CONTROL } from "#/features/organizer-detail/cache-headers";

const PUBLIC_REDIRECT_CACHE_CONTROL = "public, max-age=300";
const LEGAL_PUBLIC_PATHS = new Set([
	"/about",
	"/contact",
	"/faq",
	"/privacy",
	"/terms",
]);

export default createServerEntry(
	wrapFetchWithSentry({
		async fetch(request: Request) {
			const response = await handler.fetch(request);
			return withPublicCacheHeaders(request, response);
		},
	}),
);

function withPublicCacheHeaders(request: Request, response: Response) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return response;
	}
	if (response.headers.has("Cache-Control")) {
		return response;
	}

	const cacheControl = getPublicCacheControl(request, response.status);
	if (!cacheControl) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set("Cache-Control", cacheControl);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function getPublicCacheControl(request: Request, status: number) {
	const pathname = new URL(request.url).pathname;
	if (status >= 300 && status < 400 && isPublicDynamicPath(pathname)) {
		return PUBLIC_REDIRECT_CACHE_CONTROL;
	}
	if (status !== 200) {
		return null;
	}
	if (pathname === "/" || isPublicEventPath(pathname)) {
		return PUBLIC_EVENT_CACHE_CONTROL;
	}
	if (isPublicOrganizerPath(pathname)) {
		return ORGANIZER_DETAIL_CACHE_CONTROL;
	}
	if (LEGAL_PUBLIC_PATHS.has(pathname)) {
		return LEGAL_PAGE_CACHE_CONTROL;
	}
	return null;
}

function isPublicDynamicPath(pathname: string) {
	return isPublicEventPath(pathname) || isPublicOrganizerPath(pathname);
}

function isPublicEventPath(pathname: string) {
	const parts = pathname.split("/").filter(Boolean);
	return (
		(parts.length === 2 && parts[0] === "events") ||
		(parts.length === 3 && parts[0] === "events" && parts[2] === "register")
	);
}

function isPublicOrganizerPath(pathname: string) {
	const parts = pathname.split("/").filter(Boolean);
	return parts.length === 2 && parts[0] === "organizers";
}
