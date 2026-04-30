import { organizerPublicProfileSchema } from "@repo/shared/schemas";
import { describe, expect, it } from "vitest";
import {
	buildOrganizerCanonicalUrl,
	buildOrganizerDetailHead,
	type HeadMetaEntry,
	normalizeDescription,
	truncateGraphemes,
} from "./seo";
import type { OrganizerPublicProfile } from "./types";

const baseInput = {
	slug: "race-coimbatore",
	businessName: "Race Coimbatore Collective",
	isVerified: true,
	city: "Coimbatore",
	description:
		"Race Coimbatore Collective produces the city's flagship endurance events.",
} as const;

function buildFixture(
	overrides: Partial<OrganizerPublicProfile> = {},
): OrganizerPublicProfile {
	return organizerPublicProfileSchema.parse({
		...baseInput,
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

describe("buildOrganizerDetailHead", () => {
	it("emits title, description, OG core, and Twitter card without canonical when siteUrl is undefined", () => {
		const profile = buildFixture();
		const { meta, links } = buildOrganizerDetailHead(profile, {
			siteUrl: undefined,
		});

		const title = meta.find((e): e is { title: string } => "title" in e)?.title;
		expect(title).toBe("Race Coimbatore Collective – EventKart");

		expect(namedMeta(meta, "description")).toContain(
			"flagship endurance events",
		);
		expect(ogProperty(meta, "og:title")).toBe("Race Coimbatore Collective");
		expect(ogProperty(meta, "og:description")).toContain(
			"flagship endurance events",
		);
		expect(ogProperty(meta, "og:type")).toBe("profile");
		expect(namedMeta(meta, "twitter:card")).toBe("summary");

		expect(links).toEqual([]);
		expect(meta.some((e) => "property" in e && e.property === "og:url")).toBe(
			false,
		);
	});

	it("emits canonical link and og:url when siteUrl is set", () => {
		const profile = buildFixture();
		const { meta, links } = buildOrganizerDetailHead(profile, {
			siteUrl: "https://eventkart.in",
		});
		expect(ogProperty(meta, "og:url")).toBe(
			"https://eventkart.in/organizers/race-coimbatore",
		);
		expect(links).toEqual([
			{
				rel: "canonical",
				href: "https://eventkart.in/organizers/race-coimbatore",
			},
			{
				rel: "alternate",
				hrefLang: "en",
				href: "https://eventkart.in/organizers/race-coimbatore",
			},
			{
				rel: "alternate",
				hrefLang: "x-default",
				href: "https://eventkart.in/organizers/race-coimbatore",
			},
		]);
	});

	it("strips trailing slashes / accidental path / query / fragment from siteUrl", () => {
		const profile = buildFixture();
		for (const siteUrl of [
			"https://eventkart.in/",
			"https://eventkart.in///",
			"https://eventkart.in/some/path",
			"https://eventkart.in/?utm=x",
			"https://eventkart.in/#frag",
		]) {
			const { meta, links } = buildOrganizerDetailHead(profile, { siteUrl });
			expect(ogProperty(meta, "og:url")).toBe(
				"https://eventkart.in/organizers/race-coimbatore",
			);
			expect(links[0]?.href).toBe(
				"https://eventkart.in/organizers/race-coimbatore",
			);
			for (const link of links.filter((l) => l.rel === "alternate")) {
				expect(link.href).toBe(
					"https://eventkart.in/organizers/race-coimbatore",
				);
			}
		}
	});

	it("emits hrefLang=en and hrefLang=x-default both pointing at the canonical URL when siteUrl is set (I-2.4.7)", () => {
		const profile = buildFixture();
		const { links } = buildOrganizerDetailHead(profile, {
			siteUrl: "https://eventkart.in",
		});
		const canonical = links.find((l) => l.rel === "canonical");
		const alternates = links.filter((l) => l.rel === "alternate");
		expect(canonical?.href).toBe(
			"https://eventkart.in/organizers/race-coimbatore",
		);
		expect(alternates.map((l) => l.hrefLang)).toEqual(["en", "x-default"]);
		for (const alt of alternates) {
			expect(alt.href).toBe(canonical?.href);
		}
		expect(canonical?.hrefLang).toBeUndefined();
	});

	it("omits hrefLang entirely when siteUrl is unset (canonical is omitted too)", () => {
		const profile = buildFixture();
		const { links } = buildOrganizerDetailHead(profile, { siteUrl: undefined });
		expect(links).toEqual([]);
		expect(links.some((l) => l.rel === "alternate")).toBe(false);
	});

	it("omits hrefLang when siteUrl is malformed (no canonical → no alternates)", () => {
		const profile = buildFixture();
		const { links } = buildOrganizerDetailHead(profile, {
			siteUrl: "not a url",
		});
		expect(links).toEqual([]);
	});

	it("uses the CURRENT slug from a slug-rename payload (I-2.4.7) — never bakes in a stale slug", () => {
		// Loader returns the resolved (current) slug after a slug-rename
		// redirect; the helper must mirror that exactly so canonical and
		// hrefLang point at the live URL, not the legacy one the user typed.
		// Construct via the schema parser (slug is branded, so overriding
		// through `Partial<OrganizerPublicProfile>` is rejected by tsc).
		const profile = organizerPublicProfileSchema.parse({
			...baseInput,
			slug: "race-coimbatore-2026",
		});
		const { meta, links } = buildOrganizerDetailHead(profile, {
			siteUrl: "https://eventkart.in",
		});
		expect(ogProperty(meta, "og:url")).toBe(
			"https://eventkart.in/organizers/race-coimbatore-2026",
		);
		const canonical = links.find((l) => l.rel === "canonical");
		expect(canonical?.href).toBe(
			"https://eventkart.in/organizers/race-coimbatore-2026",
		);
		for (const alt of links.filter((l) => l.rel === "alternate")) {
			expect(alt.href).toBe(canonical?.href);
		}
	});

	it("honours the configured scheme on siteUrl (http for staging) — does not silently rewrite", () => {
		const profile = buildFixture();
		const { links } = buildOrganizerDetailHead(profile, {
			siteUrl: "http://staging.eventkart.in",
		});
		expect(links[0]?.href).toBe(
			"http://staging.eventkart.in/organizers/race-coimbatore",
		);
	});

	it("omits canonical / og:url when siteUrl is malformed", () => {
		const profile = buildFixture();
		const { meta, links } = buildOrganizerDetailHead(profile, {
			siteUrl: "not a url",
		});
		expect(meta.some((e) => "property" in e && e.property === "og:url")).toBe(
			false,
		);
		expect(links).toEqual([]);
	});

	it("emits robots=noindex,nofollow ONLY when isVerified === false", () => {
		const verified = buildOrganizerDetailHead(
			buildFixture({ isVerified: true }),
			{
				siteUrl: undefined,
			},
		);
		expect(verified.meta.some((e) => "name" in e && e.name === "robots")).toBe(
			false,
		);

		const unverified = buildOrganizerDetailHead(
			buildFixture({ isVerified: false }),
			{ siteUrl: undefined },
		);
		expect(namedMeta(unverified.meta, "robots")).toBe("noindex,nofollow");
	});

	it("falls back to a generic description when profile.description is null", () => {
		const profile = buildFixture({ description: null });
		const { meta } = buildOrganizerDetailHead(profile, { siteUrl: undefined });
		const desc = namedMeta(meta, "description");
		expect(desc).toContain("Race Coimbatore Collective");
		expect(desc).toContain("EventKart");
	});

	it("falls back to a generic description when description is whitespace-only", () => {
		const profile = buildFixture({ description: "   \n\t  " });
		const { meta } = buildOrganizerDetailHead(profile, { siteUrl: undefined });
		const desc = namedMeta(meta, "description");
		expect(desc).toContain("Race Coimbatore Collective");
	});

	it("normalizes whitespace, control chars, bidi overrides, and line separators before truncation", () => {
		const profile = buildFixture({
			description:
				"Line one.\n\n\tLine two.\u0001  Line three.\u2028 Line four.\u202E malicious",
		});
		const { meta } = buildOrganizerDetailHead(profile, { siteUrl: undefined });
		const desc = namedMeta(meta, "description");
		expect(desc).toBe("Line one. Line two. Line three. Line four. malicious");
		expect(desc).not.toContain("\u0001");
		expect(desc).not.toContain("\u2028");
		expect(desc).not.toContain("\u202E");
	});

	it("truncates a long description to 160 graphemes plus a single ellipsis", () => {
		const longText = `${"x".repeat(500)} tail`;
		const profile = buildFixture({ description: longText });
		const { meta } = buildOrganizerDetailHead(profile, { siteUrl: undefined });
		const desc = namedMeta(meta, "description");
		expect(Array.from(desc)).toHaveLength(160 + 1);
		expect(desc.endsWith("…")).toBe(true);
		expect(desc.indexOf("…")).toBe(desc.length - 1);
	});

	it("does not split astral characters or grapheme clusters at the boundary", () => {
		const cluster = "👨\u200D👩\u200D👧\u200D👦";
		const description = `${"a".repeat(159)}${cluster} extra trailing text after.`;
		const profile = buildFixture({ description });
		const { meta } = buildOrganizerDetailHead(profile, { siteUrl: undefined });
		const desc = namedMeta(meta, "description");
		expect(desc.endsWith("…")).toBe(true);
		const beforeEllipsis = desc.slice(0, -1);
		expect(
			beforeEllipsis.includes(cluster) || !beforeEllipsis.includes("👨"),
		).toBe(true);
		expect(beforeEllipsis.endsWith("\u200D")).toBe(false);
	});

	it("emits meta entries in a stable, documented order", () => {
		const profile = buildFixture({ isVerified: false });
		const { meta } = buildOrganizerDetailHead(profile, {
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
			"property:og:url",
			"name:twitter:card",
			"name:robots",
		]);
	});
});

describe("buildOrganizerCanonicalUrl", () => {
	it("returns undefined when siteUrl is undefined", () => {
		expect(buildOrganizerCanonicalUrl(undefined, "x")).toBeUndefined();
	});

	it("returns undefined when siteUrl is unparseable", () => {
		expect(
			buildOrganizerCanonicalUrl("definitely not a url", "x"),
		).toBeUndefined();
	});

	it("returns undefined for non-http(s) schemes", () => {
		expect(
			buildOrganizerCanonicalUrl("ftp://example.com", "x"),
		).toBeUndefined();
		expect(
			buildOrganizerCanonicalUrl("file:///etc/hosts", "x"),
		).toBeUndefined();
		expect(
			buildOrganizerCanonicalUrl("data:text/plain,hi", "x"),
		).toBeUndefined();
		expect(buildOrganizerCanonicalUrl("about:blank", "x")).toBeUndefined();
	});

	it("normalizes to <origin>/organizers/<slug>", () => {
		expect(
			buildOrganizerCanonicalUrl("https://example.com/foo?bar=1", "abc"),
		).toBe("https://example.com/organizers/abc");
	});
});

describe("normalizeDescription", () => {
	it("collapses runs of whitespace including tabs and newlines", () => {
		expect(normalizeDescription("a\nb\t  c\n\nd")).toBe("a b c d");
	});

	it("strips C0 control characters except tab/newline/carriage return", () => {
		expect(normalizeDescription("a\u0001b\u0007c\nd")).toBe("abc d");
	});

	it("strips DEL, C1 controls, and Unicode bidi override / isolate controls", () => {
		expect(
			normalizeDescription("a\u007Fb\u0085c\u009Fd\u202Ee\u2066f\u2069g"),
		).toBe("abcdefg");
	});

	it("normalizes Unicode line and paragraph separators to a single space", () => {
		expect(normalizeDescription("a\u2028b\u2029c")).toBe("a b c");
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
		expect(out).toBe(`${family}…`);
	});
});
