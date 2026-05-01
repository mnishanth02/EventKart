import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Resolve relative to this test file so the test is independent of cwd.
// __dirname here is .../apps/web/src/lib, public/ is two levels up.
const ROBOTS_PATH = path.resolve(__dirname, "../../public/robots.txt");

const REQUIRED_ALLOWS = [
	"Allow: /",
	"Allow: /events/",
	"Allow: /organizers/",
	"Allow: /privacy",
	"Allow: /terms",
	"Allow: /contact",
	"Allow: /about",
	"Allow: /faq",
] as const;

// Each auth-only namespace must be blocked in BOTH forms:
//   - `/<seg>$`  — exact match on the bare URL (e.g. `/org`, `/admin`).
//                  Required because `Disallow: /org/` (prefix match per
//                  RFC 9309) does NOT block `/org`. The `$` end-anchor is a
//                  widely-supported extension (Googlebot, Bingbot, Yandex).
//   - `/<seg>/`  — prefix match for everything beneath (e.g. `/org/dashboard`).
// We cannot use `Disallow: /org` (no anchor) because that would also block
// `/organizers/...` which we explicitly want crawled.
const REQUIRED_DISALLOWS = [
	"Disallow: /org$",
	"Disallow: /org/",
	"Disallow: /admin$",
	"Disallow: /admin/",
	"Disallow: /my$",
	"Disallow: /my/",
	"Disallow: /book$",
	"Disallow: /book/",
	"Disallow: /api$",
	"Disallow: /api/",
] as const;

// Sanity guard: every namespace we lock down must have BOTH the bare-exact
// form and the prefix form. Catches drift where someone removes one without
// the other.
const AUTH_NAMESPACES = ["org", "admin", "my", "book", "api"] as const;

const SITEMAP_LINE = "Sitemap: https://eventkart.in/sitemap.xml";

describe("apps/web/public/robots.txt (I-2.4.5)", () => {
	const contents = readFileSync(ROBOTS_PATH, "utf8");
	const lines = contents.split(/\r?\n/).map((l) => l.trim());

	it("declares the User-agent: * block", () => {
		expect(lines).toContain("User-agent: *");
	});

	it.each(REQUIRED_ALLOWS)("contains required allow directive: %s", (line) => {
		expect(lines).toContain(line);
	});

	it.each(
		REQUIRED_DISALLOWS,
	)("contains required disallow directive: %s", (line) => {
		expect(lines).toContain(line);
	});

	it("references the canonical sitemap URL", () => {
		expect(lines).toContain(SITEMAP_LINE);
	});

	it("does not accidentally allow auth-only namespaces", () => {
		// Guard against someone replacing a Disallow with an Allow.
		expect(contents).not.toMatch(
			/^Allow:\s+\/(org|admin|my|book|api)(?:$|\/)/m,
		);
	});

	it.each(
		AUTH_NAMESPACES,
	)("blocks both bare and nested URLs for /%s", (seg) => {
		// Bare URL form (e.g. `/org`) must be blocked via $-anchor.
		expect(lines).toContain(`Disallow: /${seg}$`);
		// Nested URL form (e.g. `/org/dashboard`) must be blocked via prefix.
		expect(lines).toContain(`Disallow: /${seg}/`);
	});
});
