/**
 * SEO head builder for the Module 2.5 static legal/public routes
 * (`/privacy`, `/terms`, `/about`, `/faq`, `/contact`). Pure function:
 * no React, no env access — all runtime config is passed in so the
 * helper is unit-testable.
 *
 * Acceptance contract:
 *  - Always emits `<title>`, `<meta name="description">`, `og:title`,
 *    `og:description`, `og:type=website`, and `twitter:card=summary`.
 *  - Emits `<meta property="og:url">` and `<link rel="canonical">` only
 *    when `siteUrl` is a parseable absolute http(s) URL. Both are
 *    normalized to `<origin><path>` via {@link buildLegalCanonicalUrl}.
 *  - Emits `<link rel="alternate" hrefLang="en">` and
 *    `<link rel="alternate" hrefLang="x-default">` only when the
 *    canonical URL itself is emitted (no site URL → no hrefLang either,
 *    since hrefLang requires absolute URLs). Both point at the same
 *    canonical href today since V1 is English-only; V2 will swap to
 *    per-locale absolute URLs (see I-2.4.7 and the matching gating in
 *    `organizer-detail/seo.ts`).
 *  - The `description` argument is passed through verbatim — these
 *    pages compose their own short descriptions (revision-controlled in
 *    source), so this helper does NOT normalize or truncate.
 *  - Per the I-2.3.1 D9 convention, the `HeadMetaEntry` and
 *    `HeadLinkEntry` shapes are re-defined locally rather than extracted
 *    to a shared helper, so each feature folder stays independent.
 */

export type HeadMetaEntry =
	| { title: string }
	| { name: string; content: string }
	| { property: string; content: string };

export interface HeadLinkEntry {
	rel: string;
	href: string;
	/**
	 * Optional `hrefLang` attribute. Set on `rel="alternate"` link tags to
	 * declare the language/locale of the target URL. V1 emits `"en"` and
	 * `"x-default"` only; V2 will add Hindi/Tamil locales.
	 *
	 * Field is named `hrefLang` (camelCase) — not `hreflang` — to match
	 * React's canonical DOM prop name. The router (`@tanstack/react-router`
	 * Asset.js) spreads link `attrs` into `<link {...attrs} />`; passing
	 * lowercase `hreflang` triggers React 19's "Invalid DOM property" dev
	 * warning. HTML5 attribute names are case-insensitive, so the
	 * serialized output `hrefLang="en"` is parsed identically to
	 * `hreflang="en"` by browsers and search crawlers (Google, Bing).
	 */
	hrefLang?: string;
}

export interface BuildLegalPageHeadOptions {
	/** Page title rendered in the `<title>` tag and `og:title`. */
	title: string;
	/**
	 * Short description rendered in `<meta name="description">` and
	 * `og:description`. Passed through verbatim — supply a final, short
	 * (≤160 chars) string from the page module.
	 */
	description: string;
	/** Absolute path beginning with `/` (e.g. `/privacy`). */
	path: string;
	/** Optional canonical site origin (e.g. `https://eventkart.in`). */
	siteUrl?: string | undefined;
}

export interface LegalPageHead {
	meta: HeadMetaEntry[];
	links: HeadLinkEntry[];
}

/**
 * Builds the meta + links payload for a static legal/public page.
 */
export function buildLegalPageHead({
	title,
	description,
	path,
	siteUrl,
}: BuildLegalPageHeadOptions): LegalPageHead {
	const canonicalUrl = buildLegalCanonicalUrl(siteUrl, path);

	const meta: HeadMetaEntry[] = [
		{ title },
		{ name: "description", content: description },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:type", content: "website" },
	];

	if (canonicalUrl) {
		meta.push({ property: "og:url", content: canonicalUrl });
	}

	meta.push({ name: "twitter:card", content: "summary" });

	const links: HeadLinkEntry[] = canonicalUrl
		? [
				{ rel: "canonical", href: canonicalUrl },
				// V1 is English-only. Per Google's hrefLang spec, every
				// alternate URL must be absolute, so we gate hrefLang on the
				// same `canonicalUrl` that gates `<link rel="canonical">`.
				// Both tags point at the same href today; when V2 adds
				// Hindi/Tamil locales we will swap to per-locale absolute URLs.
				{ rel: "alternate", hrefLang: "en", href: canonicalUrl },
				{ rel: "alternate", hrefLang: "x-default", href: canonicalUrl },
			]
		: [];

	return { meta, links };
}

/**
 * Returns `<origin><path>` or `undefined` when `siteUrl` is not a
 * parseable absolute `http(s)` URL. Any path/query/fragment on
 * `siteUrl` is stripped (only the origin is honored). `path` must
 * begin with `/`; it is composed against the origin via
 * `new URL(path, origin).href` so query/fragment in `path` are
 * preserved verbatim if a caller ever supplies them.
 */
export function buildLegalCanonicalUrl(
	siteUrl: string | undefined,
	path: string,
): string | undefined {
	if (!siteUrl) return undefined;
	let parsed: URL;
	try {
		parsed = new URL(siteUrl);
	} catch {
		return undefined;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return undefined;
	}
	const origin = parsed.origin;
	if (!origin || origin === "null") return undefined;
	return new URL(path, origin).href;
}
