import { describe, expect, it } from "vitest";
import {
	buildLegalCanonicalUrl,
	buildLegalPageHead,
	type HeadMetaEntry,
} from "./seo";

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

const baseArgs = {
	title: "Privacy Policy – EventKart",
	description: "How EventKart collects, uses, and protects your information.",
	path: "/privacy",
} as const;

describe("buildLegalPageHead", () => {
	it("emits title, description, OG core, and Twitter card without canonical when siteUrl is undefined", () => {
		const { meta, links } = buildLegalPageHead({
			...baseArgs,
			siteUrl: undefined,
		});

		const title = meta.find((e): e is { title: string } => "title" in e)?.title;
		expect(title).toBe(baseArgs.title);

		expect(namedMeta(meta, "description")).toBe(baseArgs.description);
		expect(ogProperty(meta, "og:title")).toBe(baseArgs.title);
		expect(ogProperty(meta, "og:description")).toBe(baseArgs.description);
		expect(ogProperty(meta, "og:type")).toBe("website");
		expect(namedMeta(meta, "twitter:card")).toBe("summary");

		expect(links).toEqual([]);
		expect(meta.some((e) => "property" in e && e.property === "og:url")).toBe(
			false,
		);
	});

	it("emits canonical link and og:url when siteUrl is set, composing path against the origin", () => {
		const { meta, links } = buildLegalPageHead({
			...baseArgs,
			siteUrl: "https://eventkart.in",
		});
		expect(ogProperty(meta, "og:url")).toBe("https://eventkart.in/privacy");
		expect(links).toEqual([
			{ rel: "canonical", href: "https://eventkart.in/privacy" },
			{
				rel: "alternate",
				hrefLang: "en",
				href: "https://eventkart.in/privacy",
			},
			{
				rel: "alternate",
				hrefLang: "x-default",
				href: "https://eventkart.in/privacy",
			},
		]);
	});

	it("strips trailing slashes / accidental path / query / fragment from siteUrl (only the origin is honored)", () => {
		for (const siteUrl of [
			"https://eventkart.in/",
			"https://eventkart.in///",
			"https://eventkart.in/some/path",
			"https://eventkart.in/?utm=x",
			"https://eventkart.in/#frag",
		]) {
			const { meta, links } = buildLegalPageHead({ ...baseArgs, siteUrl });
			expect(ogProperty(meta, "og:url")).toBe("https://eventkart.in/privacy");
			expect(links[0]?.href).toBe("https://eventkart.in/privacy");
			for (const link of links.filter((l) => l.rel === "alternate")) {
				expect(link.href).toBe("https://eventkart.in/privacy");
			}
		}
	});

	it("emits hrefLang=en and hrefLang=x-default both pointing at the canonical URL when siteUrl is set", () => {
		const { links } = buildLegalPageHead({
			...baseArgs,
			siteUrl: "https://eventkart.in",
		});
		const canonical = links.find((l) => l.rel === "canonical");
		const alternates = links.filter((l) => l.rel === "alternate");
		expect(canonical?.href).toBe("https://eventkart.in/privacy");
		expect(alternates.map((l) => l.hrefLang)).toEqual(["en", "x-default"]);
		for (const alt of alternates) {
			expect(alt.href).toBe(canonical?.href);
		}
		expect(canonical?.hrefLang).toBeUndefined();
	});

	it("omits hrefLang AND og:url together when siteUrl is unset (canonical is the gating signal)", () => {
		const { meta, links } = buildLegalPageHead({
			...baseArgs,
			siteUrl: undefined,
		});
		expect(links).toEqual([]);
		expect(meta.some((e) => "property" in e && e.property === "og:url")).toBe(
			false,
		);
	});

	it("omits hrefLang AND og:url when siteUrl is malformed", () => {
		const { meta, links } = buildLegalPageHead({
			...baseArgs,
			siteUrl: "not a url",
		});
		expect(links).toEqual([]);
		expect(meta.some((e) => "property" in e && e.property === "og:url")).toBe(
			false,
		);
	});

	it("omits canonical / og:url when siteUrl uses a non-http(s) scheme", () => {
		for (const siteUrl of [
			"ftp://example.com",
			"file:///etc/hosts",
			"data:text/plain,hi",
			"about:blank",
		]) {
			const { meta, links } = buildLegalPageHead({ ...baseArgs, siteUrl });
			expect(links).toEqual([]);
			expect(meta.some((e) => "property" in e && e.property === "og:url")).toBe(
				false,
			);
		}
	});

	it("composes the path argument verbatim against the origin", () => {
		for (const path of [
			"/privacy",
			"/terms",
			"/about",
			"/faq",
			"/contact",
		] as const) {
			const { meta } = buildLegalPageHead({
				...baseArgs,
				path,
				siteUrl: "https://eventkart.in",
			});
			expect(ogProperty(meta, "og:url")).toBe(`https://eventkart.in${path}`);
		}
	});

	it("passes the description through verbatim — no truncation, no normalization", () => {
		// This helper is intentionally pass-through: legal pages compose
		// their own short, revision-controlled descriptions and we MUST NOT
		// silently rewrite them here.
		const longDescription = `${"x".repeat(500)} tail with newline\nstays`;
		const { meta } = buildLegalPageHead({
			...baseArgs,
			description: longDescription,
			siteUrl: undefined,
		});
		expect(namedMeta(meta, "description")).toBe(longDescription);
		expect(ogProperty(meta, "og:description")).toBe(longDescription);
	});

	it("emits meta entries in a stable, documented order", () => {
		const { meta } = buildLegalPageHead({
			...baseArgs,
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
		]);
	});

	it("honours the configured scheme on siteUrl (http for staging) — does not silently rewrite", () => {
		const { links } = buildLegalPageHead({
			...baseArgs,
			siteUrl: "http://staging.eventkart.in",
		});
		expect(links[0]?.href).toBe("http://staging.eventkart.in/privacy");
	});
});

describe("buildLegalCanonicalUrl", () => {
	it("returns undefined when siteUrl is undefined", () => {
		expect(buildLegalCanonicalUrl(undefined, "/privacy")).toBeUndefined();
	});

	it("returns undefined when siteUrl is unparseable", () => {
		expect(
			buildLegalCanonicalUrl("definitely not a url", "/privacy"),
		).toBeUndefined();
	});

	it("returns undefined for non-http(s) schemes", () => {
		expect(
			buildLegalCanonicalUrl("ftp://example.com", "/privacy"),
		).toBeUndefined();
		expect(
			buildLegalCanonicalUrl("file:///etc/hosts", "/privacy"),
		).toBeUndefined();
		expect(
			buildLegalCanonicalUrl("data:text/plain,hi", "/privacy"),
		).toBeUndefined();
		expect(buildLegalCanonicalUrl("about:blank", "/privacy")).toBeUndefined();
	});

	it("composes <origin><path> and ignores siteUrl path/query/fragment", () => {
		expect(
			buildLegalCanonicalUrl("https://example.com/foo?bar=1", "/privacy"),
		).toBe("https://example.com/privacy");
	});
});
