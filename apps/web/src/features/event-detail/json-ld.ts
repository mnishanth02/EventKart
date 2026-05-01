import {
	buildCanonicalUrl,
	normalizeDescription,
	truncateGraphemes,
} from "./seo";
import type { EventPublicDetail } from "./types";

/**
 * Builds the Schema.org `Event` JSON-LD object for `/events/:slug` (I-2.1.6).
 *
 * The returned object is consumed by the route's `head().scripts` after
 * passing through {@link serializeJsonLdForInlineScript}. That helper mirrors
 * TanStack Router's internal `script:ld+json` escaping pipeline so hostile
 * text such as `</script>` cannot break out of the inline JSON-LD script.
 *
 * Pure function of `(event, options)` — output is fully deterministic so
 * it stays compatible with the I-2.1.1 CDN cache contract
 * (`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`,
 * no `Vary: Cookie`). No clock reads, no random IDs, no env reads.
 *
 * Acceptance contract (I-2.1.6):
 *  - Required Google Event rich-result fields: `@context`, `@type`,
 *    `name`, `startDate`, `endDate`, `eventStatus`,
 *    `eventAttendanceMode`, `location.{name, address.*}`.
 *  - `image` is **omitted** (parity with I-2.1.5 D5 — hero is a 1-hour
 *    presigned URL; embedding it would break Google's image-cache
 *    invariants once the URL expires). Tracked as a follow-up tied to
 *    the stable image-serving slice.
 *  - Optional fields are omitted (not `null` / empty) when absent so
 *    the emitted snippet stays compact.
 */
export interface BuildPublicEventJsonLdOptions {
	/** Optional canonical site origin (e.g. `https://eventkart.in`). */
	siteUrl: string | undefined;
}

export interface PostalAddressJsonLd {
	"@type": "PostalAddress";
	streetAddress: string;
	addressLocality: string;
	addressRegion: string;
	addressCountry: string;
	postalCode?: string;
}

export interface PlaceJsonLd {
	"@type": "Place";
	name: string;
	address: PostalAddressJsonLd;
}

export interface OrganizationJsonLd {
	"@type": "Organization";
	name: string;
	url?: string;
}

export interface OfferJsonLd {
	"@type": "Offer";
	/** INR major units. JSON number per Google Event docs (not a string). */
	price: number;
	priceCurrency: string;
	availability: "https://schema.org/InStock";
	name?: string;
	url?: string;
	validFrom?: string;
	validThrough?: string;
}

export interface BreadcrumbItemJsonLd {
	"@type": "ListItem";
	position: number;
	name: string;
	item: string;
}

export interface BreadcrumbListJsonLd {
	"@context": "https://schema.org";
	"@type": "BreadcrumbList";
	itemListElement: BreadcrumbItemJsonLd[];
}

export interface BuildPublicEventBreadcrumbJsonLdOptions {
	/** Optional canonical site origin (e.g. `https://eventkart.in`). */
	siteUrl?: string | undefined;
}

export interface EventJsonLd {
	"@context": "https://schema.org";
	"@type": "Event";
	name: string;
	description: string;
	startDate: string;
	endDate: string;
	eventStatus: "https://schema.org/EventScheduled";
	eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode";
	inLanguage: "en-IN";
	isAccessibleForFree: boolean;
	location: PlaceJsonLd;
	organizer: OrganizationJsonLd;
	url?: string;
	offers?: OfferJsonLd[];
}

const SCHEMA_ORG_CONTEXT = "https://schema.org" as const;
const EVENT_STATUS_SCHEDULED = "https://schema.org/EventScheduled" as const;
const ATTENDANCE_MODE_OFFLINE =
	"https://schema.org/OfflineEventAttendanceMode" as const;
const AVAILABILITY_IN_STOCK = "https://schema.org/InStock" as const;
const LANGUAGE_TAG = "en-IN" as const;
const HTML_ESCAPE_LOOKUP: Record<string, string> = {
	"&": "\\u0026",
	">": "\\u003e",
	"<": "\\u003c",
	"\u2028": "\\u2028",
	"\u2029": "\\u2029",
};
const HTML_ESCAPE_PATTERN = /[&><\u2028\u2029]/g;
// Defensive cap on the JSON-LD description: the DB column for
// `events.description` is unbounded `text`, and this string is embedded
// inline in served HTML on every event page render. 5000 graphemes is
// well above SERP truncation while keeping cached HTML payloads bounded.
const DESCRIPTION_MAX_GRAPHEMES = 5000;

/**
 * Generic over the JSON-LD payload shape so it can serialize both
 * {@link EventJsonLd} (I-2.1.6) and {@link BreadcrumbListJsonLd} (I-2.4.8)
 * — and any future JSON-LD payload — through the same trust boundary.
 * The runtime behavior is identical for every shape: `JSON.stringify` then
 * replace the framework `escapeHtml` set (`& > < U+2028 U+2029`) so a
 * `</script>` payload in user content can never break out of the inline
 * `<script type="application/ld+json">`.
 */
export function serializeJsonLdForInlineScript<T>(jsonLd: T): string {
	return JSON.stringify(jsonLd).replace(
		HTML_ESCAPE_PATTERN,
		(match) => HTML_ESCAPE_LOOKUP[match] ?? match,
	);
}

export function buildPublicEventJsonLd(
	event: EventPublicDetail,
	options: BuildPublicEventJsonLdOptions,
): EventJsonLd {
	const siteOrigin = resolveSiteOrigin(options.siteUrl);
	const canonicalEventUrl = buildCanonicalUrl(options.siteUrl, event.slug);
	const organizerUrl = siteOrigin
		? new URL(`/organizers/${event.organizer.slug}`, siteOrigin).href
		: undefined;

	const description = truncateGraphemes(
		normalizeDescription(event.description),
		DESCRIPTION_MAX_GRAPHEMES,
	);

	const result: EventJsonLd = {
		"@context": SCHEMA_ORG_CONTEXT,
		"@type": "Event",
		name: event.title,
		description,
		startDate: event.startAt,
		endDate: event.endAt,
		eventStatus: EVENT_STATUS_SCHEDULED,
		eventAttendanceMode: ATTENDANCE_MODE_OFFLINE,
		inLanguage: LANGUAGE_TAG,
		isAccessibleForFree: !event.isPaid,
		location: buildLocation(event),
		organizer: buildOrganizer(event, organizerUrl),
	};

	if (canonicalEventUrl) {
		result.url = canonicalEventUrl;
	}

	const offers = buildOffers(event, canonicalEventUrl);
	if (offers.length > 0) {
		result.offers = offers;
	}

	return result;
}

function buildLocation(event: EventPublicDetail): PlaceJsonLd {
	const streetAddress =
		event.addressLine2 != null && event.addressLine2.length > 0
			? `${event.addressLine1}, ${event.addressLine2}`
			: event.addressLine1;

	const address: PostalAddressJsonLd = {
		"@type": "PostalAddress",
		streetAddress,
		addressLocality: event.city,
		addressRegion: event.state,
		addressCountry: event.country,
	};
	if (event.postalCode != null && event.postalCode.length > 0) {
		address.postalCode = event.postalCode;
	}

	return {
		"@type": "Place",
		name: event.venueName,
		address,
	};
}

function buildOrganizer(
	event: EventPublicDetail,
	organizerUrl: string | undefined,
): OrganizationJsonLd {
	const organizer: OrganizationJsonLd = {
		"@type": "Organization",
		name: event.organizer.businessName,
	};
	if (organizerUrl) {
		organizer.url = organizerUrl;
	}
	return organizer;
}

function buildOffers(
	event: EventPublicDetail,
	canonicalEventUrl: string | undefined,
): OfferJsonLd[] {
	if (event.pricingTiers.length === 0) return [];
	const categoryNameBySlug = new Map<string, string>();
	for (const category of event.categories) {
		categoryNameBySlug.set(category.slug, category.name);
	}
	return event.pricingTiers.map((tier) => {
		// Schema.org `Offer.price` is a Number per Google's Event rich
		// result examples. `eventPriceSchema` enforces a minimum of 100
		// paise so the divide always yields a positive finite Number.
		const offer: OfferJsonLd = {
			"@type": "Offer",
			price: tier.basePrice / 100,
			priceCurrency: tier.currency,
			availability: AVAILABILITY_IN_STOCK,
		};
		const offerName =
			categoryNameBySlug.get(tier.categorySlug) ?? tier.categorySlug;
		offer.name = offerName;
		if (canonicalEventUrl) {
			offer.url = canonicalEventUrl;
		}
		if (event.registrationOpensAt) {
			offer.validFrom = event.registrationOpensAt;
		}
		if (event.registrationClosesAt) {
			// Schema.org-valid; Google's Event docs only document
			// `validFrom`, so the validator may ignore this field. We
			// keep it for schema.org completeness and for non-Google
			// crawlers that consume `validThrough`.
			offer.validThrough = event.registrationClosesAt;
		}
		return offer;
	});
}

/**
 * Builds the Schema.org `BreadcrumbList` JSON-LD payload for `/events/:slug`
 * (I-2.4.8). Three items: Home → Events → `{event.title}`, with positions
 * 1, 2, 3 and absolute URLs derived from the canonical site origin.
 *
 * Returns `null` (fail-soft) when `siteUrl` is missing or not a parseable
 * `http(s)` URL — Schema.org `BreadcrumbList.itemListElement[].item` MUST
 * be an absolute URL, and emitting relative paths or invalid links would
 * trigger validator warnings without delivering the rich-snippet benefit.
 * Mirrors the canonical-link contract from I-2.4.7 / I-2.1.5.
 *
 * Pure function of `(event, options)` — output is fully deterministic so
 * it stays compatible with the I-2.1.1 CDN cache contract
 * (`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`,
 * no `Vary: Cookie`). No clock reads, no random IDs, no env reads.
 *
 * The returned object is consumed by the route's `head().scripts` after
 * passing through {@link serializeJsonLdForInlineScript} — that helper is
 * the trust boundary that prevents `</script>` injection from a hostile
 * `event.title` breaking out of the inline JSON-LD script.
 */
export function buildPublicEventBreadcrumbJsonLd(
	event: EventPublicDetail,
	options: BuildPublicEventBreadcrumbJsonLdOptions,
): BreadcrumbListJsonLd | null {
	const siteOrigin = resolveSiteOrigin(options.siteUrl);
	if (!siteOrigin) return null;

	// Use the WHATWG URL parser for every item so trailing slashes,
	// repeated slashes, or accidental path/query/fragment on `siteUrl`
	// (already stripped by `resolveSiteOrigin`) cannot produce
	// `//events/` or other malformed hrefs. `new URL(path, origin).href`
	// always yields the canonicalized absolute URL.
	const homeUrl = new URL("/", siteOrigin).href;
	const eventsUrl = new URL("/events", siteOrigin).href;
	const eventUrl = new URL(`/events/${event.slug}`, siteOrigin).href;

	return {
		"@context": SCHEMA_ORG_CONTEXT,
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "Home", item: homeUrl },
			{ "@type": "ListItem", position: 2, name: "Events", item: eventsUrl },
			{
				"@type": "ListItem",
				position: 3,
				name: event.title,
				item: eventUrl,
			},
		],
	};
}

/**
 * Returns the canonical site origin (`https://host[:port]`) when
 * `siteUrl` is a parseable absolute `http(s)` URL, otherwise `undefined`.
 * Mirrors {@link buildCanonicalUrl}'s validation to keep `organizer.url`,
 * `offers[].url`, and the top-level `url` consistent with the OG /
 * canonical contract from I-2.1.5.
 */
function resolveSiteOrigin(siteUrl: string | undefined): string | undefined {
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
	if (!parsed.origin || parsed.origin === "null") return undefined;
	return parsed.origin;
}
