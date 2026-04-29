import { describe, expect, it } from "vitest";
import { eventPublicDetailSchema } from "@repo/shared/schemas";
import type { EventPublicDetail } from "./types";
import {
	buildCanonicalUrl,
	buildPublicEventMeta,
	type HeadMetaEntry,
	normalizeDescription,
	truncateGraphemes,
} from "./seo";

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
	overrides: Partial<EventPublicDetail> = {},
): EventPublicDetail {
	return eventPublicDetailSchema.parse({
		...baseFixtureInput,
		...overrides,
	});
}

function findMeta(
	entries: HeadMetaEntry[],
	predicate: (entry: HeadMetaEntry) => boolean,
): HeadMetaEntry | undefined {
	return entries.find(predicate);
}

function ogProperty(entries: HeadMetaEntry[], property: string): string {
	const entry = findMeta(
		entries,
		(e): e is { property: string; content: string } =>
			"property" in e && e.property === property,
	);
	if (!entry || !("content" in entry)) {
		throw new Error(`og property '${property}' not found`);
	}
	return entry.content;
}

function namedMeta(entries: HeadMetaEntry[], name: string): string {
	const entry = findMeta(
		entries,
		(e): e is { name: string; content: string } =>
			"name" in e && e.name === name,
	);
	if (!entry || !("content" in entry)) {
		throw new Error(`meta name '${name}' not found`);
	}
	return entry.content;
}

describe("buildPublicEventMeta", () => {
	it("emits the title, description, OG core, and Twitter card with default site name", () => {
		const event = buildFixture();
		const { meta, links } = buildPublicEventMeta(event, { siteUrl: undefined });

		const title = meta.find(
			(e): e is { title: string } => "title" in e,
		)?.title;
		expect(title).toBe("Coimbatore City 10K — eventKart");

		expect(namedMeta(meta, "description")).toContain("polished city race");
		expect(namedMeta(meta, "twitter:card")).toBe("summary");
		expect(namedMeta(meta, "twitter:title")).toBe("Coimbatore City 10K");
		expect(namedMeta(meta, "twitter:description")).toContain(
			"polished city race",
		);

		expect(ogProperty(meta, "og:title")).toBe("Coimbatore City 10K");
		expect(ogProperty(meta, "og:description")).toContain("polished city race");
		expect(ogProperty(meta, "og:type")).toBe("website");
		expect(ogProperty(meta, "og:site_name")).toBe("eventKart");
		expect(ogProperty(meta, "og:locale")).toBe("en_IN");

		expect(links).toEqual([]);
		expect(
			meta.some((e) => "property" in e && e.property === "og:url"),
		).toBe(false);
	});

	it("honours a custom siteName for og:site_name", () => {
		const event = buildFixture();
		const { meta } = buildPublicEventMeta(event, {
			siteUrl: undefined,
			siteName: "EventKart India",
		});
		expect(ogProperty(meta, "og:site_name")).toBe("EventKart India");
	});

	it("emits canonical and og:url only when siteUrl is set, normalizing to <origin>/events/<slug>", () => {
		const event = buildFixture();
		const { meta, links } = buildPublicEventMeta(event, {
			siteUrl: "https://eventkart.in",
		});
		expect(ogProperty(meta, "og:url")).toBe(
			"https://eventkart.in/events/coimbatore-city-10k",
		);
		expect(links).toEqual([
			{
				rel: "canonical",
				href: "https://eventkart.in/events/coimbatore-city-10k",
			},
		]);
	});

	it("strips trailing slashes / accidental path / query / fragment from VITE_SITE_URL", () => {
		const event = buildFixture();
		for (const siteUrl of [
			"https://eventkart.in/",
			"https://eventkart.in///",
			"https://eventkart.in/some/path",
			"https://eventkart.in/?utm=x",
			"https://eventkart.in/#frag",
		]) {
			const { meta, links } = buildPublicEventMeta(event, { siteUrl });
			expect(ogProperty(meta, "og:url")).toBe(
				"https://eventkart.in/events/coimbatore-city-10k",
			);
			expect(links[0]?.href).toBe(
				"https://eventkart.in/events/coimbatore-city-10k",
			);
		}
	});

	it("omits canonical / og:url when siteUrl is malformed", () => {
		const event = buildFixture();
		const { meta, links } = buildPublicEventMeta(event, {
			siteUrl: "not a url",
		});
		expect(
			meta.some((e) => "property" in e && e.property === "og:url"),
		).toBe(false);
		expect(links).toEqual([]);
	});

	it("never emits og:image or twitter:image, even when heroImage is populated", () => {
		const event = buildFixture();
		const { meta } = buildPublicEventMeta(event, {
			siteUrl: "https://eventkart.in",
		});
		expect(
			meta.some(
				(e) =>
					("property" in e && e.property.startsWith("og:image")) ||
					("name" in e && e.name.startsWith("twitter:image")),
			),
		).toBe(false);
	});

	it("also omits image tags when heroImage is null", () => {
		const event = buildFixture({ heroImage: null });
		const { meta } = buildPublicEventMeta(event, { siteUrl: undefined });
		expect(
			meta.some(
				(e) =>
					("property" in e && e.property.startsWith("og:image")) ||
					("name" in e && e.name.startsWith("twitter:image")),
			),
		).toBe(false);
	});

	it("preserves a short description without ellipsis or truncation", () => {
		const event = buildFixture({ description: "Short and sweet." });
		const { meta } = buildPublicEventMeta(event, { siteUrl: undefined });
		expect(namedMeta(meta, "description")).toBe("Short and sweet.");
		expect(ogProperty(meta, "og:description")).toBe("Short and sweet.");
	});

	it("truncates a long description with a single ellipsis at the cap", () => {
		const longText = `${"x".repeat(500)} tail`;
		const event = buildFixture({ description: longText });
		const { meta } = buildPublicEventMeta(event, { siteUrl: undefined });
		const desc = namedMeta(meta, "description");
		const og = ogProperty(meta, "og:description");
		expect(Array.from(desc)).toHaveLength(160 + 1);
		expect(desc.endsWith("…")).toBe(true);
		expect(desc.indexOf("…")).toBe(desc.length - 1);
		expect(Array.from(og)).toHaveLength(200 + 1);
		expect(og.endsWith("…")).toBe(true);
	});

	it("normalizes whitespace and strips C0 controls before truncation", () => {
		const event = buildFixture({
			description: "Line one.\n\n\tLine two.\u0001  Line three.",
		});
		const { meta } = buildPublicEventMeta(event, { siteUrl: undefined });
		expect(namedMeta(meta, "description")).toBe(
			"Line one. Line two. Line three.",
		);
	});

	it("does not split astral characters or grapheme clusters at the boundary", () => {
		// Grapheme cluster '👨‍👩‍👧‍👦' is one user-perceived character composed
		// of multiple code points joined by ZWJ. Place it exactly at the cap.
		const cluster = "👨\u200D👩\u200D👧\u200D👦";
		const description = `${"a".repeat(159)}${cluster} extra trailing text after.`;
		const event = buildFixture({ description });
		const { meta } = buildPublicEventMeta(event, { siteUrl: undefined });
		const desc = namedMeta(meta, "description");
		expect(desc.endsWith("…")).toBe(true);
		// The cluster is either included whole or excluded whole — never split.
		const beforeEllipsis = desc.slice(0, -1);
		expect(beforeEllipsis.includes(cluster) || !beforeEllipsis.includes("👨")).toBe(true);
		// And no isolated surrogates / lone ZWJ trailing the visible text.
		expect(beforeEllipsis.endsWith("\u200D")).toBe(false);
	});

	it("emits meta entries in the documented contract order", () => {
		const event = buildFixture();
		const { meta } = buildPublicEventMeta(event, {
			siteUrl: "https://eventkart.in",
		});
		const keys = meta.map((entry) => {
			if ("title" in entry) return "title";
			if ("name" in entry) return `name:${entry.name}`;
			return `property:${entry.property}`;
		});
		expect(keys).toEqual([
			"title",
			"name:description",
			"property:og:title",
			"property:og:description",
			"property:og:type",
			"property:og:site_name",
			"property:og:locale",
			"property:og:url",
			"name:twitter:card",
			"name:twitter:title",
			"name:twitter:description",
		]);
	});
});

describe("buildCanonicalUrl", () => {
	it("returns undefined when siteUrl is undefined", () => {
		expect(buildCanonicalUrl(undefined, "x")).toBeUndefined();
	});

	it("returns undefined when siteUrl is unparseable", () => {
		expect(buildCanonicalUrl("definitely not a url", "x")).toBeUndefined();
	});

	it("returns undefined for non-http(s) schemes", () => {
		expect(buildCanonicalUrl("ftp://example.com", "x")).toBeUndefined();
		expect(buildCanonicalUrl("file:///etc/hosts", "x")).toBeUndefined();
		expect(
			buildCanonicalUrl("data:text/plain,hi", "x"),
		).toBeUndefined();
		expect(buildCanonicalUrl("about:blank", "x")).toBeUndefined();
	});

	it("normalizes to <origin>/events/<slug>", () => {
		expect(buildCanonicalUrl("https://example.com/foo?bar=1", "abc")).toBe(
			"https://example.com/events/abc",
		);
	});
});

describe("normalizeDescription", () => {
	it("collapses runs of whitespace including tabs and newlines", () => {
		expect(normalizeDescription("a\nb\t  c\n\nd")).toBe("a b c d");
	});

	it("trims leading and trailing whitespace", () => {
		expect(normalizeDescription("  hi  ")).toBe("hi");
	});

	it("strips C0 control characters except tab/newline/carriage return", () => {
		expect(normalizeDescription("a\u0001b\u0007c\nd")).toBe("abc d");
	});

	it("strips DEL, C1 controls, and Unicode bidi override / isolate controls", () => {
		// DEL, C1 controls (e.g., NEL/U+0085, U+009F), bidi RLO (U+202E),
		// bidi isolates (U+2066-U+2069) — none should survive. Stripping
		// runs before whitespace collapse, so they leave no separator.
		expect(
			normalizeDescription(
				"a\u007Fb\u0085c\u009Fd\u202Ee\u2066f\u2069g",
			),
		).toBe("abcdefg");
	});

	it("preserves ZWJ so emoji clusters survive normalization", () => {
		const family = "👨\u200D👩\u200D👧\u200D👦";
		expect(normalizeDescription(`hello ${family} world`)).toBe(
			`hello ${family} world`,
		);
	});
});

describe("truncateGraphemes", () => {
	it("returns the input unchanged when within the cap", () => {
		expect(truncateGraphemes("hello", 10)).toBe("hello");
	});

	it("appends exactly one ellipsis on truncation", () => {
		expect(truncateGraphemes("abcdef", 3)).toBe("abc…");
	});

	it("treats max=0 as the empty string", () => {
		expect(truncateGraphemes("anything", 0)).toBe("");
	});

	it("does not split a ZWJ family emoji cluster", () => {
		const family = "👨\u200D👩\u200D👧\u200D👦";
		const out = truncateGraphemes(`${family}${family}`, 1);
		// One grapheme + ellipsis. Whole cluster is preserved.
		expect(out).toBe(`${family}…`);
	});
});
