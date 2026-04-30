import { eventPublicDetailSchema } from "@repo/shared/schemas";
import { describe, expect, it } from "vitest";
import {
	buildPublicEventJsonLd,
	type EventJsonLd,
	type OfferJsonLd,
	serializeJsonLdForInlineScript,
} from "./json-ld";
import type { EventPublicDetail } from "./types";

const baseFixtureInput = {
	slug: "coimbatore-city-10k",
	title: "Coimbatore City 10K",
	description:
		"A polished city race with shaded roads, hydration support, and a festive finish line.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road",
	addressLine2: null,
	city: "Coimbatore",
	state: "Tamil Nadu",
	country: "India",
	postalCode: "641018",
	timezone: "Asia/Kolkata",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails:
		"Start at Race Course, loop through Avinashi Road, and finish under the grandstand.",
	refundPolicy: null,
	cancellationPolicy: null,
	isPaid: true,
	currency: "INR",
	organizer: {
		slug: "race-coimbatore",
		businessName: "Race Coimbatore Collective",
		isVerified: true,
		city: "Coimbatore",
		description: null,
	},
	heroImage: {
		kind: "hero",
		contentType: "image/jpeg",
		url: "https://cdn.example.com/hero.jpg",
		expiresAt: "2026-08-14T12:00:00.000Z",
	},
	routeMapImage: null,
	categories: [
		{
			name: "10K Open",
			slug: "10k",
			distanceMeters: 10000,
			sortOrder: 1,
			capacity: { spotsTotal: 200, spotsRemaining: 150 },
		},
	],
	pricingTiers: [
		{
			categorySlug: "10k",
			basePrice: 129_900,
			earlyBirdPrice: null,
			earlyBirdDeadline: null,
			currency: "INR",
		},
	],
} as const;

function buildFixture(
	// `EventPublicDetail` exposes branded slug types (e.g. `EventCategorySlug`),
	// but our overrides are raw string literals from test fixtures that get
	// branded only after `eventPublicDetailSchema.parse(...)`. Accept an
	// unbranded structural override here and let parse() do the branding;
	// any structural mismatch still fails at runtime via Zod.
	overrides: Record<string, unknown> = {},
): EventPublicDetail {
	return eventPublicDetailSchema.parse({
		...baseFixtureInput,
		...overrides,
	});
}

const SITE_URL = "https://eventkart.in";

describe("buildPublicEventJsonLd", () => {
	it("emits all Google-required Event fields with the expected schema.org URI literals", () => {
		const event = buildFixture();
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });

		expect(jsonLd["@context"]).toBe("https://schema.org");
		expect(jsonLd["@type"]).toBe("Event");
		expect(jsonLd.name).toBe("Coimbatore City 10K");
		expect(jsonLd.startDate).toBe("2026-08-15T00:30:00.000Z");
		expect(jsonLd.endDate).toBe("2026-08-15T03:30:00.000Z");
		expect(jsonLd.eventStatus).toBe("https://schema.org/EventScheduled");
		expect(jsonLd.eventAttendanceMode).toBe(
			"https://schema.org/OfflineEventAttendanceMode",
		);
		expect(jsonLd.inLanguage).toBe("en-IN");
		expect(jsonLd.location["@type"]).toBe("Place");
		expect(jsonLd.location.name).toBe("Race Course Grounds");
		expect(jsonLd.location.address["@type"]).toBe("PostalAddress");
		expect(jsonLd.location.address.streetAddress).toBe("Race Course Road");
		expect(jsonLd.location.address.addressLocality).toBe("Coimbatore");
		expect(jsonLd.location.address.addressRegion).toBe("Tamil Nadu");
		expect(jsonLd.location.address.addressCountry).toBe("India");
		expect(jsonLd.location.address.postalCode).toBe("641018");
	});

	it("always emits endDate from event.endAt (event.endAt is required)", () => {
		const event = buildFixture();
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect(jsonLd.endDate).toBe(event.endAt);
		expect("endDate" in jsonLd).toBe(true);
	});

	it("normalizes the description (strips C0/C1/DEL/bidi controls, collapses whitespace, preserves ZWJ)", () => {
		const family = "👨\u200D👩\u200D👧\u200D👦";
		const event = buildFixture({
			description: `Line one.\n\n\tLine two.\u0001\u202E  Line three. ${family}`,
		});
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect(jsonLd.description).toBe(
			`Line one. Line two. Line three. ${family}`,
		);
	});

	it("caps the description at 5000 graphemes with a single ellipsis when exceeded", () => {
		const longText = "x".repeat(6000);
		const event = buildFixture({ description: longText });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect(Array.from(jsonLd.description)).toHaveLength(5000 + 1);
		expect(jsonLd.description.endsWith("…")).toBe(true);
	});

	it("leaves a short description unchanged (no ellipsis, no truncation)", () => {
		const event = buildFixture({ description: "Short and sweet." });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect(jsonLd.description).toBe("Short and sweet.");
	});

	it("uses addressLine1 alone for streetAddress when addressLine2 is null", () => {
		const event = buildFixture({ addressLine2: null });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect(jsonLd.location.address.streetAddress).toBe("Race Course Road");
	});

	it("joins addressLine1 + addressLine2 with ', ' when both are present", () => {
		const event = buildFixture({ addressLine2: "Near Stadium Gate 4" });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect(jsonLd.location.address.streetAddress).toBe(
			"Race Course Road, Near Stadium Gate 4",
		);
	});

	it("omits postalCode from PostalAddress when null", () => {
		const event = buildFixture({ postalCode: null });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect("postalCode" in jsonLd.location.address).toBe(false);
	});

	it("never emits an `image` field even when heroImage is populated", () => {
		const event = buildFixture();
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: SITE_URL });
		expect("image" in jsonLd).toBe(false);
	});

	it("emits canonical event url only when siteUrl is set", () => {
		const without = buildPublicEventJsonLd(buildFixture(), {
			siteUrl: undefined,
		});
		expect("url" in without).toBe(false);

		const withSiteUrl = buildPublicEventJsonLd(buildFixture(), {
			siteUrl: SITE_URL,
		});
		expect(withSiteUrl.url).toBe(
			"https://eventkart.in/events/coimbatore-city-10k",
		);
	});

	it("emits organizer.url only when siteUrl is a valid http(s) origin", () => {
		const event = buildFixture();
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: SITE_URL });
		expect(jsonLd.organizer["@type"]).toBe("Organization");
		expect(jsonLd.organizer.name).toBe("Race Coimbatore Collective");
		expect(jsonLd.organizer.url).toBe(
			"https://eventkart.in/organizers/race-coimbatore",
		);
	});

	it("omits organizer.url when siteUrl is malformed or non-http(s)", () => {
		const event = buildFixture();
		for (const siteUrl of [
			undefined,
			"not a url",
			"ftp://example.com",
			"file:///etc/hosts",
			"about:blank",
			"data:text/plain,hi",
		]) {
			const jsonLd = buildPublicEventJsonLd(event, { siteUrl });
			expect("url" in jsonLd.organizer).toBe(false);
			expect("url" in jsonLd).toBe(false);
		}
	});

	it("strips trailing slashes and accidental path/query/fragment from siteUrl when building organizer.url", () => {
		const event = buildFixture();
		for (const siteUrl of [
			"https://eventkart.in/",
			"https://eventkart.in///",
			"https://eventkart.in/some/path",
			"https://eventkart.in/?utm=x",
			"https://eventkart.in/#frag",
		]) {
			const jsonLd = buildPublicEventJsonLd(event, { siteUrl });
			expect(jsonLd.organizer.url).toBe(
				"https://eventkart.in/organizers/race-coimbatore",
			);
		}
	});

	it("omits offers when pricingTiers is empty", () => {
		const event = buildFixture({ pricingTiers: [] });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: SITE_URL });
		expect("offers" in jsonLd).toBe(false);
	});

	it("emits one Offer per pricing tier with price as a JSON Number (paise / 100)", () => {
		const event = buildFixture({
			categories: [
				{
					name: "10K Open",
					slug: "10k",
					distanceMeters: 10000,
					sortOrder: 1,
					capacity: { spotsTotal: 200, spotsRemaining: 150 },
				},
				{
					name: "Half Marathon",
					slug: "21k",
					distanceMeters: 21097,
					sortOrder: 2,
					capacity: { spotsTotal: 300, spotsRemaining: 275 },
				},
			],
			pricingTiers: [
				{
					categorySlug: "10k",
					basePrice: 129_900,
					earlyBirdPrice: null,
					earlyBirdDeadline: null,
					currency: "INR",
				},
				{
					categorySlug: "21k",
					basePrice: 199_950,
					earlyBirdPrice: null,
					earlyBirdDeadline: null,
					currency: "INR",
				},
			],
		});
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: SITE_URL });
		expect(jsonLd.offers).toHaveLength(2);
		const offers = jsonLd.offers as OfferJsonLd[];
		expect(offers[0]?.["@type"]).toBe("Offer");
		expect(offers[0]?.price).toBe(1299);
		expect(typeof offers[0]?.price).toBe("number");
		expect(offers[0]?.priceCurrency).toBe("INR");
		expect(offers[0]?.availability).toBe("https://schema.org/InStock");
		expect(offers[0]?.name).toBe("10K Open");
		expect(offers[1]?.price).toBe(1999.5);
		expect(offers[1]?.name).toBe("Half Marathon");
	});

	it("formats fractional paise correctly (non-multiple-of-100)", () => {
		const event = buildFixture({
			pricingTiers: [
				{
					categorySlug: "10k",
					basePrice: 129_950,
					earlyBirdPrice: null,
					earlyBirdDeadline: null,
					currency: "INR",
				},
			],
		});
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: SITE_URL });
		const offers = jsonLd.offers as OfferJsonLd[];
		expect(offers[0]?.price).toBe(1299.5);
	});

	it("falls back to categorySlug as Offer.name when no matching category exists", () => {
		const event = buildFixture({
			categories: [],
			pricingTiers: [
				{
					categorySlug: "10k",
					basePrice: 129_900,
					earlyBirdPrice: null,
					earlyBirdDeadline: null,
					currency: "INR",
				},
			],
		});
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		const offers = jsonLd.offers as OfferJsonLd[];
		expect(offers[0]?.name).toBe("10k");
	});

	it("emits Offer.validFrom and validThrough only when the corresponding registration timestamps are set", () => {
		const event = buildFixture({
			registrationOpensAt: null,
			registrationClosesAt: null,
		});
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: SITE_URL });
		const offers = jsonLd.offers as OfferJsonLd[];
		expect("validFrom" in (offers[0] ?? {})).toBe(false);
		expect("validThrough" in (offers[0] ?? {})).toBe(false);

		const eventWithTimes = buildFixture();
		const jsonLdWithTimes = buildPublicEventJsonLd(eventWithTimes, {
			siteUrl: SITE_URL,
		});
		const offersWithTimes = jsonLdWithTimes.offers as OfferJsonLd[];
		expect(offersWithTimes[0]?.validFrom).toBe("2026-07-01T03:30:00.000Z");
		expect(offersWithTimes[0]?.validThrough).toBe("2026-08-14T12:30:00.000Z");
	});

	it("emits Offer.url only when siteUrl is set", () => {
		const event = buildFixture();
		const without = buildPublicEventJsonLd(event, { siteUrl: undefined });
		const withSite = buildPublicEventJsonLd(event, { siteUrl: SITE_URL });
		const offersWithout = without.offers as OfferJsonLd[];
		const offersWith = withSite.offers as OfferJsonLd[];
		expect("url" in (offersWithout[0] ?? {})).toBe(false);
		expect(offersWith[0]?.url).toBe(
			"https://eventkart.in/events/coimbatore-city-10k",
		);
	});

	it("preserves pricingTiers input order in the offers array", () => {
		const event = buildFixture({
			categories: [
				{
					name: "5K",
					slug: "5k",
					distanceMeters: 5000,
					sortOrder: 1,
					capacity: { spotsTotal: 100, spotsRemaining: 80 },
				},
				{
					name: "10K",
					slug: "10k",
					distanceMeters: 10000,
					sortOrder: 2,
					capacity: { spotsTotal: 200, spotsRemaining: 150 },
				},
				{
					name: "21K",
					slug: "21k",
					distanceMeters: 21097,
					sortOrder: 3,
					capacity: { spotsTotal: 300, spotsRemaining: 250 },
				},
			],
			pricingTiers: [
				{
					categorySlug: "21k",
					basePrice: 199_900,
					earlyBirdPrice: null,
					earlyBirdDeadline: null,
					currency: "INR",
				},
				{
					categorySlug: "5k",
					basePrice: 99_900,
					earlyBirdPrice: null,
					earlyBirdDeadline: null,
					currency: "INR",
				},
				{
					categorySlug: "10k",
					basePrice: 129_900,
					earlyBirdPrice: null,
					earlyBirdDeadline: null,
					currency: "INR",
				},
			],
		});
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		const offers = jsonLd.offers as OfferJsonLd[];
		expect(offers.map((o) => o.name)).toEqual(["21K", "5K", "10K"]);
	});

	it("emits isAccessibleForFree=true when event.isPaid is false (and false otherwise)", () => {
		const paid = buildPublicEventJsonLd(buildFixture({ isPaid: true }), {
			siteUrl: undefined,
		});
		expect(paid.isAccessibleForFree).toBe(false);

		const free = buildPublicEventJsonLd(
			buildFixture({ isPaid: false, pricingTiers: [] }),
			{ siteUrl: undefined },
		);
		expect(free.isAccessibleForFree).toBe(true);
		// Free events with no pricing tiers also have no `offers` array.
		expect("offers" in free).toBe(false);
	});

	it("is JSON-serializable round-trip with no `undefined` properties on the top-level object", () => {
		const event = buildFixture({ pricingTiers: [], postalCode: null });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		const roundTripped = JSON.parse(JSON.stringify(jsonLd)) as EventJsonLd;
		expect(roundTripped).toEqual(jsonLd);
		// No `undefined` leaked into emitted keys.
		for (const key of Object.keys(jsonLd)) {
			expect(jsonLd[key as keyof EventJsonLd]).not.toBeUndefined();
		}
	});

	it("treats empty-string addressLine2 the same as null (uses addressLine1 alone)", () => {
		const event = buildFixture({ addressLine2: "" });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect(jsonLd.location.address.streetAddress).toBe("Race Course Road");
	});

	it("omits postalCode when it is an empty string", () => {
		const event = buildFixture({ postalCode: "" });
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: undefined });
		expect("postalCode" in jsonLd.location.address).toBe(false);
	});

	it("omits Offer.url for every malformed or non-http(s) siteUrl", () => {
		const event = buildFixture();
		for (const siteUrl of [
			undefined,
			"not a url",
			"ftp://example.com",
			"file:///etc/hosts",
			"about:blank",
			"data:text/plain,hi",
		]) {
			const jsonLd = buildPublicEventJsonLd(event, { siteUrl });
			const offers = jsonLd.offers as OfferJsonLd[];
			expect("url" in (offers[0] ?? {})).toBe(false);
		}
	});

	it("survives hostile content end-to-end through JSON.stringify + the framework's escapeHtml", () => {
		// Mirror the route's inline JSON-LD pipeline:
		//   children: serializeJsonLdForInlineScript(payload)
		// This verifies that a `</script>` payload in user content can
		// never break out of the inline <script type="application/ld+json">.
		const event = buildFixture({
			description: "Great race </script><script>alert(1)</script> finish!",
			venueName: "Race </script>Grounds",
			organizer: {
				slug: "race-coimbatore",
				businessName: "Race </script> Coimbatore",
				isVerified: true,
				city: "Coimbatore",
				description: null,
			},
		});
		const jsonLd = buildPublicEventJsonLd(event, { siteUrl: SITE_URL });
		const embedded = serializeJsonLdForInlineScript(jsonLd);

		// `<` is escaped to `\u003c` (note: as the literal six-character
		// sequence in the JS string, not as the `<` codepoint).
		expect(embedded).not.toContain("</script>");
		expect(embedded).not.toContain("<script");
		expect(embedded).toContain("\\u003c/script\\u003e");
		// And the original payload is recoverable when the browser parses
		// the script tag — escapeHtml only escapes HTML-significant chars
		// inside the JSON string literal; JSON.parse undoes the escape.
		expect(
			JSON.parse(
				embedded
					.replace(/\\u003c/g, "<")
					.replace(/\\u003e/g, ">")
					.replace(/\\u0026/g, "&"),
			),
		).toEqual(jsonLd);
	});
});

describe("serializeJsonLdForInlineScript", () => {
	// The serializer is the trust boundary that prevents `</script>` and
	// `<!--` HTML raw-text breakout from inline JSON-LD. Cover every
	// character in the escape map directly so a future edit that drops
	// any one of them is caught instantly. Mirrors the lookup used by
	// TanStack Router's framework `escapeHtml`.
	function payloadWith(name: string): EventJsonLd {
		return {
			"@context": "https://schema.org",
			"@type": "Event",
			name,
			description: "x",
			startDate: "2026-01-01T00:00:00.000Z",
			endDate: "2026-01-01T01:00:00.000Z",
			eventStatus: "https://schema.org/EventScheduled",
			eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
			inLanguage: "en-IN",
			isAccessibleForFree: false,
			location: {
				"@type": "Place",
				name: "v",
				address: {
					"@type": "PostalAddress",
					streetAddress: "s",
					addressLocality: "c",
					addressRegion: "r",
					addressCountry: "India",
				},
			},
			organizer: { "@type": "Organization", name: "o" },
		};
	}

	it("escapes every entry in the framework escape map (& > < U+2028 U+2029)", () => {
		const cases: Array<[string, string]> = [
			["&", "\\u0026"],
			[">", "\\u003e"],
			["<", "\\u003c"],
			// JSON.stringify already encodes U+2028/U+2029 as `\u2028`/`\u2029`
			// six-char sequences, so the regex match operates on the literal
			// codepoints inside the JSON string. Asserting the raw codepoint
			// is absent (in either form) catches a regression that drops the
			// regex entry.
			["\u2028", "\\u2028"],
			["\u2029", "\\u2029"],
		];
		for (const [input, escaped] of cases) {
			const out = serializeJsonLdForInlineScript(payloadWith(input));
			expect(out).toContain(escaped);
			expect(out).not.toContain(input);
		}
	});

	it("returns valid JSON when round-tripped through HTML-decoding", () => {
		const out = serializeJsonLdForInlineScript(
			payloadWith("Sample &<>\u2028\u2029 mixed"),
		);
		const decoded = out
			.replace(/\\u003c/g, "<")
			.replace(/\\u003e/g, ">")
			.replace(/\\u0026/g, "&")
			.replace(/\\u2028/g, "\u2028")
			.replace(/\\u2029/g, "\u2029");
		expect(() => JSON.parse(decoded)).not.toThrow();
	});
});
