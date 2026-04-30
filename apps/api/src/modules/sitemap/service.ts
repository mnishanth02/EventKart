import type { Database } from "@repo/db";
import { and, eq, gt } from "@repo/db";
import { events, organizers } from "@repo/db/schema";
import type { FastifyBaseLogger } from "fastify";

/**
 * I-2.4.4 — Sitemap protocol XML generation.
 *
 * V1 emits a single `<urlset>` document with up to 50,000 URLs (the
 * sitemaps.org per-file ceiling). Past that we'd switch to a
 * `<sitemapindex>` of segmented files — see the plan doc for the V2
 * migration sketch. Today the platform has well under 1,000 published
 * events + verified organizers; capping at 50k is a defensive guard,
 * not a near-term concern.
 *
 * Source-of-truth for `<lastmod>`:
 *   `events.updatedAt ?? events.publishedAt ?? events.createdAt`
 *   `organizers.updatedAt`
 * `updatedAt` is `$onUpdate(() => new Date())` on both tables, so it
 * advances on every write. Using it (rather than `publishedAt` alone)
 * makes the sitemap accurately reflect post-publish edits — critical
 * for I-2.3.2 published-edit flows that don't bump `publishedAt`.
 *
 * Filtering rules:
 *   * Events: `status = 'published'` AND `endAt > now()` — past events
 *     are excluded (we never want them indexed; their `/events/<slug>`
 *     pages still resolve but Google would treat fresh indexing of a
 *     dead event as low-quality).
 *   * Organizers: `isVerified = true`. The schema has no `is_listed`
 *     column today; if added later, AND it in here.
 */

export const SITEMAP_URL_LIMIT = 50_000;

const FALLBACK_BASE_URL = "https://eventkart.in";

export interface BuildSitemapXmlDeps {
	db: Pick<Database, "select">;
	log: Pick<FastifyBaseLogger, "info" | "warn">;
	cdnBaseUrl?: string;
}

interface UrlEntry {
	loc: string;
	lastmod: Date;
}

/**
 * Pick the freshest available timestamp from a set of candidates, with
 * `null`/`undefined` skipped. Returns `new Date(0)` only if every
 * candidate is missing — that should never happen for the columns we
 * query (all NOT NULL except publishedAt) but we defend against it
 * anyway so a single bad row can't crash the whole sitemap render.
 */
function pickLastmod(...candidates: Array<Date | null | undefined>): Date {
	for (const c of candidates) {
		if (c instanceof Date) {
			return c;
		}
	}
	return new Date(0);
}

/**
 * Format a `Date` as an ISO-8601 timestamp with explicit `+00:00`
 * offset, per the sitemap protocol's W3C Datetime profile. We always
 * emit UTC so the value is reproducible regardless of process TZ.
 */
function formatLastmod(date: Date): string {
	const iso = date.toISOString(); // "2026-08-15T00:30:00.000Z"
	// Drop milliseconds (sitemaps.org examples use second precision)
	// and replace trailing "Z" with the explicit "+00:00" offset
	// preferred by the spec example block.
	const seconds = iso.slice(0, 19);
	return `${seconds}+00:00`;
}

/**
 * XML escape: covers the five characters required by XML 1.0. Slugs in
 * EventKart are normalised to `[a-z0-9-]` so escaping is defensive —
 * but the URL also contains the `<loc>` *base* (CDN host) and a future
 * accidental `&` in the env var would otherwise produce invalid XML.
 */
function escapeXml(value: string): string {
	let out = "";
	for (const ch of value) {
		switch (ch) {
			case "&":
				out += "&amp;";
				break;
			case "<":
				out += "&lt;";
				break;
			case ">":
				out += "&gt;";
				break;
			case '"':
				out += "&quot;";
				break;
			case "'":
				out += "&apos;";
				break;
			default:
				out += ch;
		}
	}
	return out;
}

function joinUrl(base: string, path: string): string {
	const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
	const trimmedPath = path.startsWith("/") ? path : `/${path}`;
	return `${trimmedBase}${trimmedPath}`;
}

/**
 * Render a `<url>` block. `<changefreq>` and `<priority>` are
 * informational hints to crawlers — Google ignores them in practice
 * but we emit them for protocol conformance and for crawlers (Bing,
 * Yandex) that still honour them.
 */
function renderUrlEntry(entry: UrlEntry): string {
	return [
		"  <url>",
		`    <loc>${escapeXml(entry.loc)}</loc>`,
		`    <lastmod>${formatLastmod(entry.lastmod)}</lastmod>`,
		"    <changefreq>daily</changefreq>",
		"    <priority>0.7</priority>",
		"  </url>",
	].join("\n");
}

export async function buildSitemapXml(
	deps: BuildSitemapXmlDeps,
	now: Date = new Date(),
): Promise<string> {
	let baseUrl = deps.cdnBaseUrl;
	if (!baseUrl) {
		// CDN_BASE_URL is optional in dev/test; warn loudly so a
		// missed prod env var is visible in logs but never crash —
		// /sitemap.xml must always render, even if the host is wrong.
		deps.log.warn(
			{ fallback: FALLBACK_BASE_URL },
			"CDN_BASE_URL is not configured; sitemap will use fallback host",
		);
		baseUrl = FALLBACK_BASE_URL;
	}

	const urlset: UrlEntry[] = [];

	// Static high-priority pages — homepage. Discovery surfaces have no
	// stable `lastmod` so we use `now` for them. `/events` and
	// `/organizers` listing pages are intentionally NOT included; they
	// are paginated and Google would prefer the canonical detail URLs.
	urlset.push({
		loc: joinUrl(baseUrl, "/"),
		lastmod: now,
	});

	// 1) Published, future events. Cap by the protocol limit (defensive;
	// V1 traffic is ~hundreds of events). Order is unspecified by the
	// protocol — we order by id for stability across regenerations,
	// which keeps the cached XML byte-identical when nothing changed.
	const remaining = () => SITEMAP_URL_LIMIT - urlset.length;
	if (remaining() > 0) {
		const eventRows = await deps.db
			.select({
				slug: events.slug,
				updatedAt: events.updatedAt,
				publishedAt: events.publishedAt,
				createdAt: events.createdAt,
			})
			.from(events)
			.where(and(eq(events.status, "published"), gt(events.endAt, now)))
			.orderBy(events.id)
			.limit(remaining());

		for (const row of eventRows) {
			urlset.push({
				loc: joinUrl(baseUrl, `/events/${row.slug}`),
				lastmod: pickLastmod(row.updatedAt, row.publishedAt, row.createdAt),
			});
			if (urlset.length >= SITEMAP_URL_LIMIT) break;
		}
	}

	// 2) Verified organizers. Schema has no `is_listed` column today;
	// `isVerified=true` is the public-listing signal (matches the
	// public-organizer-profile lookup contract).
	if (remaining() > 0) {
		const organizerRows = await deps.db
			.select({
				slug: organizers.slug,
				updatedAt: organizers.updatedAt,
			})
			.from(organizers)
			.where(eq(organizers.isVerified, true))
			.orderBy(organizers.id)
			.limit(remaining());

		for (const row of organizerRows) {
			urlset.push({
				loc: joinUrl(baseUrl, `/organizers/${row.slug}`),
				lastmod: row.updatedAt,
			});
			if (urlset.length >= SITEMAP_URL_LIMIT) break;
		}
	}

	deps.log.info(
		{ urlCount: urlset.length, capped: urlset.length >= SITEMAP_URL_LIMIT },
		"sitemap.xml generated",
	);

	const body = urlset.map(renderUrlEntry).join("\n");
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		body,
		"</urlset>",
		"",
	].join("\n");
}
