import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
	Link: ({ children, to }: { children: ReactNode; to: string }) => (
		<a href={to} data-testid="router-link">
			{children}
		</a>
	),
}));

import { serializeJsonLdForInlineScript } from "#/features/event-detail/json-ld";
import { buildFaqPageJsonLd, FAQ_ITEMS, FaqPageView } from "./faq";

afterEach(() => {
	cleanup();
});

describe("FaqPageView", () => {
	it("renders the H1 supplied by LegalPageLayout", () => {
		render(<FaqPageView items={FAQ_ITEMS} />);
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: "Frequently Asked Questions",
			}),
		).toBeDefined();
	});

	it("renders all five FAQ question headings", () => {
		render(<FaqPageView items={FAQ_ITEMS} />);
		const expectedQuestions = [
			"How does booking work?",
			"How do I view a past booking?",
			"What is the refund process?",
			"What happens on event day?",
			"Is my data safe?",
		];
		for (const question of expectedQuestions) {
			expect(
				screen.getByRole("heading", { level: 3, name: question }),
			).toBeDefined();
		}
	});

	it("includes the data-safety language guard (DPDPA-aware / data minimization)", () => {
		const { container } = render(<FaqPageView items={FAQ_ITEMS} />);
		const text = container.textContent ?? "";
		expect(text).toContain("DPDPA-aware");
		expect(text).toContain("data minimization");
	});

	it("exposes a mailto link to the EventKart support address", () => {
		const { container } = render(<FaqPageView items={FAQ_ITEMS} />);
		const mailto = container.querySelector(
			'a[href="mailto:support@eventkart.run"]',
		);
		expect(mailto).not.toBeNull();
	});

	it("links out to /privacy, /terms, and /contact", () => {
		const { container } = render(<FaqPageView items={FAQ_ITEMS} />);
		expect(container.querySelector('a[href="/privacy"]')).not.toBeNull();
		expect(container.querySelector('a[href="/terms"]')).not.toBeNull();
		expect(container.querySelector('a[href="/contact"]')).not.toBeNull();
	});
});

describe("buildFaqPageJsonLd", () => {
	it("emits a valid Schema.org FAQPage shape", () => {
		const jsonLd = buildFaqPageJsonLd();
		expect(jsonLd["@context"]).toBe("https://schema.org");
		expect(jsonLd["@type"]).toBe("FAQPage");
		expect(jsonLd.mainEntity).toHaveLength(5);
	});

	it("preserves question/answer alignment with FAQ_ITEMS in source order", () => {
		const jsonLd = buildFaqPageJsonLd();
		jsonLd.mainEntity.forEach((entry, index) => {
			const item = FAQ_ITEMS[index];
			expect(item).toBeDefined();
			if (!item) return;
			expect(entry["@type"]).toBe("Question");
			expect(entry.name).toBe(item.question);
			expect(entry.acceptedAnswer["@type"]).toBe("Answer");
			expect(entry.acceptedAnswer.text).toBe(item.plainTextAnswer);
		});
	});

	it("emits non-empty plain-text answers (no HTML tags, no JSX leakage)", () => {
		const jsonLd = buildFaqPageJsonLd();
		for (const entry of jsonLd.mainEntity) {
			const text = entry.acceptedAnswer.text;
			expect(typeof text).toBe("string");
			expect(text.length).toBeGreaterThan(0);
			// JSON-LD answer text must be plain — no raw HTML tags from
			// accidental serialization of a JSX node.
			expect(text).not.toMatch(/<\/?[a-z][\s\S]*?>/i);
		}
	});

	it("survives the inline-script escape boundary (no raw `<` or `>` in output)", () => {
		const embedded = serializeJsonLdForInlineScript(buildFaqPageJsonLd());
		// `serializeJsonLdForInlineScript` HTML-escapes `<` -> `\u003c`
		// and `>` -> `\u003e` so a `</script>` payload in any answer can
		// never break out of the inline <script type="application/ld+json">.
		expect(embedded).not.toMatch(/[<>]/);
		// Sanity: the escape preserves a parseable JSON document.
		const parsed = JSON.parse(embedded) as { "@type": string };
		expect(parsed["@type"]).toBe("FAQPage");
	});
});
