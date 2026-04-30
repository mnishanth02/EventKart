import type { EventPublicDetail } from "./types";

/**
 * Builds the `head()` payload (TanStack Start `meta` + `links`) for the
 * public event detail route. Pure function: no React, no env access — all
 * runtime config is passed in so the helper is unit-testable.
 *
 * Acceptance contract (I-2.1.5):
 *  - Always emits `<title>`, `<meta name="description">`, the OG core
 *    (`og:title`, `og:description`, `og:type`, `og:site_name`, `og:locale`),
 *    and Twitter card text fields.
 *  - Emits `<meta property="og:url">` and `<link rel="canonical">` only
 *    when `siteUrl` is provided. Both are normalized to `<origin>/events/<slug>`
 *    via {@link buildCanonicalUrl} so accidental trailing slashes or
 *    path/query suffixes on `VITE_SITE_URL` cannot produce broken URLs.
 *  - Emits `<link rel="alternate" hreflang="en">` and
 *    `<link rel="alternate" hreflang="x-default">` (I-2.4.7) — both
 *    pointing at the same canonical URL since V1 is English-only. They
 *    are emitted only when the canonical URL itself is emitted (no site
 *    URL → no hreflang either, since same-origin relative hreflang is
 *    invalid per Google's spec). When V2 adds Hindi/Tamil locales, these
 *    same-href tags become per-locale absolute URLs (see
 *    `docs/impl-plan/feature-2.4-I-2.4.7.md`).
 *  - Does not emit `og:image` / `twitter:image`. The hero image is a
 *    1-hour presigned URL; social platforms cache OG images for days, so
 *    embedding it would produce broken previews after eviction. A stable
 *    image-serving slice is tracked as a follow-up.
 */
export interface BuildPublicEventMetaOptions {
	/** Optional canonical site origin (e.g. `https://eventkart.in`). */
	siteUrl: string | undefined;
	/** og:site_name. Defaults to `"eventKart"`. */
	siteName?: string | undefined;
}

export type HeadMetaEntry =
	| { title: string }
	| { name: string; content: string }
	| { property: string; content: string };

export interface HeadLinkEntry {
	rel: string;
	href: string;
	/**
	 * Optional `hreflang` attribute. Set on `rel="alternate"` link tags to
	 * declare the language/locale of the target URL. V1 emits `"en"` and
	 * `"x-default"` only; V2 will add Hindi/Tamil locales.
	 */
	hreflang?: string;
}

export interface PublicEventHead {
	meta: HeadMetaEntry[];
	links: HeadLinkEntry[];
}

const DEFAULT_SITE_NAME = "eventKart";
const DEFAULT_LOCALE = "en_IN";
const DESCRIPTION_MAX_GRAPHEMES = 160;
const OG_DESCRIPTION_MAX_GRAPHEMES = 200;
const TITLE_SUFFIX = " — eventKart";

export function buildPublicEventMeta(
	event: EventPublicDetail,
	options: BuildPublicEventMetaOptions,
): PublicEventHead {
	const siteName = options.siteName ?? DEFAULT_SITE_NAME;
	const canonicalUrl = buildCanonicalUrl(options.siteUrl, event.slug);
	const normalizedDescription = normalizeDescription(event.description);
	const metaDescription = truncateGraphemes(
		normalizedDescription,
		DESCRIPTION_MAX_GRAPHEMES,
	);
	const ogDescription = truncateGraphemes(
		normalizedDescription,
		OG_DESCRIPTION_MAX_GRAPHEMES,
	);
	const pageTitle = `${event.title}${TITLE_SUFFIX}`;

	const meta: HeadMetaEntry[] = [
		{ title: pageTitle },
		{ name: "description", content: metaDescription },
		{ property: "og:title", content: event.title },
		{ property: "og:description", content: ogDescription },
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: siteName },
		{ property: "og:locale", content: DEFAULT_LOCALE },
	];

	if (canonicalUrl) {
		meta.push({ property: "og:url", content: canonicalUrl });
	}

	meta.push(
		{ name: "twitter:card", content: "summary" },
		{ name: "twitter:title", content: event.title },
		{ name: "twitter:description", content: ogDescription },
	);

	const links: HeadLinkEntry[] = canonicalUrl
		? [
				{ rel: "canonical", href: canonicalUrl },
				// V1 is English-only. Per Google's hreflang spec, every
				// alternate URL must be absolute, so we gate hreflang on the
				// same `canonicalUrl` that gates `<link rel="canonical">`.
				// Both tags point at the same href today; when V2 adds
				// Hindi/Tamil locales we will swap to per-locale absolute URLs
				// (see `docs/impl-plan/feature-2.4-I-2.4.7.md`).
				{ rel: "alternate", hreflang: "en", href: canonicalUrl },
				{ rel: "alternate", hreflang: "x-default", href: canonicalUrl },
			]
		: [];

	return { meta, links };
}

/**
 * Returns `<origin>/events/<slug>` or `undefined` when `siteUrl` is not a
 * parseable absolute `http(s)` URL. Any path/query/fragment on `siteUrl`
 * is stripped (only the origin is honored), and slashes are normalized
 * via the WHATWG URL parser so trailing or doubled slashes never produce
 * `//events/`. Non-web schemes (`ftp:`, `file:`, `data:`, `about:`,
 * `blob:`, …) are rejected so a misconfigured `VITE_SITE_URL` cannot
 * leak a non-canonical scheme into share previews.
 */
export function buildCanonicalUrl(
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
	return new URL(`/events/${slug}`, origin).href;
}

/**
 * Description text on `events.description` is plain prose
 * (`z.string().min(1)`) with no HTML stripping or whitespace
 * normalization. Before truncation we strip:
 *   - C0 control characters (except `\t` / `\n` / `\r` which are
 *     legitimate whitespace and get collapsed by `\s+` below),
 *   - DEL (`U+007F`) and C1 controls (`U+0080-U+009F`),
 *   - Unicode bidi override / isolate controls (`U+202A-U+202E`,
 *     `U+2066-U+2069`) — these can spoof the visible direction of a
 *     share-preview snippet without altering its codepoints,
 * then collapse any run of whitespace — including newlines, tabs, and
 * `\u00A0`/`\uFEFF` (`\s` covers both) — to a single space, and trim.
 * ZWJ (`U+200D`) is intentionally preserved so emoji clusters remain
 * intact for the grapheme-aware truncator. Result is single-line and
 * free of stray control characters in social previews.
 */
// Stripped character class for normalizeDescription. Includes C0 controls
// (except `\t`/`\n`/`\r` which `\s+` collapses), DEL, C1 controls, and
// Unicode bidi override / isolate controls. ZWJ (`U+200D`) is intentionally
// preserved so emoji clusters survive normalization for the truncator.
// Built via `new RegExp` to avoid the `noControlCharactersInRegex` rule
// that fires on a literal pattern containing these escapes.
// biome-ignore lint/complexity/useRegexLiterals: literal form would trigger noControlCharactersInRegex
const STRIPPED_CONTROL_CHARS_PATTERN = new RegExp(
	"[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u202A-\\u202E\\u2066-\\u2069]",
	"g",
);

export function normalizeDescription(input: string): string {
	return input
		.replace(STRIPPED_CONTROL_CHARS_PATTERN, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Truncates `input` to at most `max` user-perceived characters
 * (graphemes). Appends a single horizontal ellipsis (`…`) when (and only
 * when) truncation actually happened.
 *
 * Uses `Intl.Segmenter` (Node 22+ / modern browsers) as the primary path
 * so ZWJ emoji sequences (👨‍👩‍👧‍👦), regional-indicator pairs (🇮🇳), and
 * combining-mark clusters are kept intact. Falls back to `Array.from(str)`
 * which is **code-point-safe** (no surrogate-pair corruption) but
 * **not grapheme-cluster-safe** — only used when `Intl.Segmenter` is
 * absent at runtime. The fallback still beats UTF-16-unit slicing.
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
