import { createFileRoute } from "@tanstack/react-router";
import { serializeJsonLdForInlineScript } from "#/features/event-detail/json-ld";
import {
	LEGAL_PAGE_CACHE_CONTROL,
	setLegalPageCacheHeaders,
} from "#/features/legal-pages/cache-headers";
import {
	buildFaqPageJsonLd,
	FAQ_ITEMS,
	FaqPageView,
} from "#/features/legal-pages/faq";
import { buildLegalPageHead } from "#/features/legal-pages/seo";

/**
 * Public FAQ page (I-2.5.5).
 *
 * SSR + CDN-cached static page covering the five core booking questions
 * called out in `docs/v1-implementation-plan.md` row 548 (booking flow,
 * past-booking lookup, refunds, event-day handling, data safety).
 *
 * Render strategy: uses the shadcn/ui {@link Accordion} primitive from
 * `@repo/ui/components/ui/accordion` (verified present at component-
 * placement audit time). `type="multiple"` keeps every item independently
 * expandable so the rendered DOM matches the SSR-emitted `data-state`
 * for a stable hydration pass and stays usable when JS is disabled
 * (Radix's accordion remains keyboard-operable post-hydration). The
 * native `<details>` fallback documented at the top of the legal-pages
 * folder remains the recommended swap if the Accordion primitive ever
 * goes away — every item already carries a deterministic `value` taken
 * from `FAQ_ITEMS[i].id`.
 *
 * The same `FAQ_ITEMS` const drives both the rendered Q&A list and the
 * Schema.org `FAQPage` JSON-LD `mainEntity`. Each item carries a JSX
 * `answer` (used in the rendered DOM) plus a parallel `plainTextAnswer`
 * (used in JSON-LD; Google's FAQPage spec requires plain text — no
 * HTML, no JSX). When editing copy, edit BOTH fields.
 */

const FAQ_PAGE_DESCRIPTION =
	"How EventKart booking works: browse, OTP at submission, UPI/card payment, refund process, event-day QR check-in, and our data-safety posture.";

interface FaqRouteData {
	siteUrl: string | undefined;
}

export const Route = createFileRoute("/_public/faq")({
	ssr: true,
	loader: async () => {
		await setLegalPageCacheHeaders(
			new Headers({ "Cache-Control": LEGAL_PAGE_CACHE_CONTROL }),
		);
		const { publicEnv } = await import("#/lib/env/public");
		return {
			siteUrl: publicEnv.VITE_SITE_URL,
		} satisfies FaqRouteData;
	},
	head: ({ loaderData }) => {
		const data = loaderData as FaqRouteData | undefined;
		const head = buildLegalPageHead({
			title: "FAQ — EventKart",
			description: FAQ_PAGE_DESCRIPTION,
			path: "/faq",
			siteUrl: data?.siteUrl,
		});
		return {
			...head,
			scripts: [
				{
					type: "application/ld+json",
					children: serializeJsonLdForInlineScript(buildFaqPageJsonLd()),
				},
			],
		};
	},
	component: FaqRouteComponent,
});

function FaqRouteComponent() {
	return <FaqPageView items={FAQ_ITEMS} />;
}
