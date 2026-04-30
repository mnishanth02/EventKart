import type { OrganizerPublicProfile } from "./types";

/**
 * Builds the `head()` payload (TanStack Start `meta` + `links`) for the
 * public organizer profile route (I-2.3.1). Pure function: no React, no
 * env access — all runtime config is passed in so the helper is
 * unit-testable.
 *
 * Acceptance contract:
 *  - Always emits `<title>`, `<meta name="description">`, `og:title`,
 *    `og:description`, `og:type=profile`, and `twitter:card=summary`.
 *  - Emits `<meta property="og:url">` and `<link rel="canonical">` only
 *    when `siteUrl` is provided. Both are normalized to
 *    `<origin>/organizers/<slug>` via {@link buildOrganizerCanonicalUrl}.
 *  - Emits `<meta name="robots" content="noindex,nofollow">` when (and
 *    only when) `profile.isVerified === false`. Unverified organizers
 *    are still publicly addressable so verified-event detail pages
 *    keep working, but we do not want them appearing in search results
 *    until they pass KYC review.
 *  - Falls back to a generic description when `profile.description` is
 *    `null` so social previews never render an empty string.
 *  - Per the I-2.3.1 spec, helpers (`normalizeDescription`,
 *    `truncateGraphemes`) are duplicated locally rather than extracted
 *    from `event-detail/seo.ts` (D9 — keep features independent).
 */
export interface BuildOrganizerDetailHeadOptions {
	/** Optional canonical site origin (e.g. `https://eventkart.in`). */
	siteUrl: string | undefined;
}

export type HeadMetaEntry =
	| { title: string }
	| { name: string; content: string }
	| { property: string; content: string };

export interface HeadLinkEntry {
	rel: string;
	href: string;
}

export interface OrganizerDetailHead {
	meta: HeadMetaEntry[];
	links: HeadLinkEntry[];
}

const TITLE_SUFFIX = " – EventKart";
const DESCRIPTION_MAX_GRAPHEMES = 160;
const DEFAULT_DESCRIPTION_PREFIX = "Discover events organized by";
const DEFAULT_DESCRIPTION_SUFFIX = "on EventKart.";

/**
 * Builds the meta + links payload for the public organizer profile page.
 *
 * @param profile Resolved public organizer profile.
 * @param options Runtime config (canonical site origin, etc.).
 */
export function buildOrganizerDetailHead(
	profile: OrganizerPublicProfile,
	options: BuildOrganizerDetailHeadOptions,
): OrganizerDetailHead {
	const canonicalUrl = buildOrganizerCanonicalUrl(
		options.siteUrl,
		profile.slug,
	);
	const description = resolveDescription(profile);
	const pageTitle = `${profile.businessName}${TITLE_SUFFIX}`;

	const meta: HeadMetaEntry[] = [
		{ title: pageTitle },
		{ name: "description", content: description },
		{ property: "og:title", content: profile.businessName },
		{ property: "og:description", content: description },
		{ property: "og:type", content: "profile" },
	];

	if (canonicalUrl) {
		meta.push({ property: "og:url", content: canonicalUrl });
	}

	meta.push({ name: "twitter:card", content: "summary" });

	if (profile.isVerified === false) {
		meta.push({ name: "robots", content: "noindex,nofollow" });
	}

	const links: HeadLinkEntry[] = canonicalUrl
		? [{ rel: "canonical", href: canonicalUrl }]
		: [];

	return { meta, links };
}

/**
 * Returns `<origin>/organizers/<slug>` or `undefined` when `siteUrl` is
 * not a parseable absolute `http(s)` URL. Any path/query/fragment on
 * `siteUrl` is stripped (only the origin is honored).
 */
export function buildOrganizerCanonicalUrl(
	siteUrl: string | undefined,
	slug: string,
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
	return new URL(`/organizers/${slug}`, origin).href;
}

function resolveDescription(profile: OrganizerPublicProfile): string {
	if (profile.description === null) {
		return `${DEFAULT_DESCRIPTION_PREFIX} ${profile.businessName} ${DEFAULT_DESCRIPTION_SUFFIX}`;
	}
	const normalized = normalizeDescription(profile.description);
	if (normalized.length === 0) {
		return `${DEFAULT_DESCRIPTION_PREFIX} ${profile.businessName} ${DEFAULT_DESCRIPTION_SUFFIX}`;
	}
	return truncateGraphemes(normalized, DESCRIPTION_MAX_GRAPHEMES);
}

// Stripped character class for normalizeDescription. Includes C0 controls
// (except `\t`/`\n`/`\r` which `\s+` collapses), DEL, C1 controls, and
// Unicode bidi override / isolate controls. Built via `new RegExp` to
// avoid the `noControlCharactersInRegex` rule that fires on a literal
// pattern containing these escapes.
// biome-ignore lint/complexity/useRegexLiterals: literal form would trigger noControlCharactersInRegex
const STRIPPED_CONTROL_CHARS_PATTERN = new RegExp(
	"[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u202A-\\u202E\\u2066-\\u2069]",
	"g",
);

// biome-ignore lint/complexity/useRegexLiterals: keep parity with the control-chars pattern above
const LINE_PARAGRAPH_SEPARATOR_PATTERN = new RegExp("[\\u2028\\u2029]", "g");

/**
 * Normalizes free-form organizer description text for SEO meta tags.
 *
 * Strips C0/C1 control characters, DEL, Unicode bidi override / isolate
 * controls, and Unicode line/paragraph separators (`\u2028`, `\u2029`)
 * which would otherwise break crawler line handling. Then collapses
 * whitespace runs (including newlines, tabs, NBSP, BOM) to a single
 * space and trims. ZWJ (`U+200D`) is preserved so emoji clusters survive.
 *
 * Duplicated locally per I-2.3.1 D9 — do not extract a shared helper.
 */
export function normalizeDescription(input: string): string {
	return input
		.replace(STRIPPED_CONTROL_CHARS_PATTERN, "")
		.replace(LINE_PARAGRAPH_SEPARATOR_PATTERN, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Truncates `input` to at most `max` user-perceived characters
 * (graphemes). Appends a single horizontal ellipsis (`…`) when (and only
 * when) truncation actually happened.
 *
 * Uses `Intl.Segmenter` (Node 22+ / modern browsers) so ZWJ emoji
 * sequences, regional-indicator pairs, and combining-mark clusters stay
 * intact. Falls back to `Array.from(str)` (code-point-safe but not
 * grapheme-cluster-safe) only when `Intl.Segmenter` is unavailable.
 *
 * Duplicated locally per I-2.3.1 D9.
 */
export function truncateGraphemes(input: string, max: number): string {
	if (max <= 0) return "";
	const graphemes = splitGraphemes(input);
	if (graphemes.length <= max) return input;
	return `${graphemes.slice(0, max).join("")}…`;
}

function splitGraphemes(input: string): string[] {
	const segmenter = getSegmenter();
	if (segmenter) {
		const out: string[] = [];
		for (const segment of segmenter.segment(input)) {
			out.push(segment.segment);
		}
		return out;
	}
	return Array.from(input);
}

let cachedSegmenter: Intl.Segmenter | null | undefined;

function getSegmenter(): Intl.Segmenter | null {
	if (cachedSegmenter !== undefined) return cachedSegmenter;
	const SegmenterCtor: typeof Intl.Segmenter | undefined = (
		Intl as { Segmenter?: typeof Intl.Segmenter }
	).Segmenter;
	if (typeof SegmenterCtor !== "function") {
		cachedSegmenter = null;
		return cachedSegmenter;
	}
	try {
		cachedSegmenter = new SegmenterCtor("en", { granularity: "grapheme" });
	} catch {
		cachedSegmenter = null;
	}
	return cachedSegmenter;
}
