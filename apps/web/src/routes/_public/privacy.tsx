import { createFileRoute } from "@tanstack/react-router";
import {
	LEGAL_PAGE_CACHE_CONTROL,
	setLegalPageCacheHeaders,
} from "#/features/legal-pages/cache-headers";
import { PrivacyPage } from "#/features/legal-pages/components/privacy-page";
import { buildLegalPageHead } from "#/features/legal-pages/seo";

/**
 * I-2.5.1 -- SSR `/privacy` policy page.
 *
 * Content is sourced verbatim/paraphrased from product-plan.md
 * Section 13 ("Privacy and Data Handling") and requirements.md
 * Section 4 ("Trust, Privacy, and Data Handling Requirements"); do not
 * invent legal claims here. The displayed `version` is wired to
 * `PARTICIPANT_LEGAL_VERSIONS.privacy` so the page label and the
 * `consent_records.consent_version` value stamped at booking
 * submission stay in lockstep (Phase 3 booking flow keys on the same
 * constant). Bumping the privacy version constant requires updating
 * `effectiveDate` below in the same change set.
 *
 * SEO: emits canonical + hreflang via `buildLegalPageHead` once
 * `VITE_SITE_URL` is provided. CDN: ships the shared
 * `LEGAL_PAGE_CACHE_CONTROL` header (1h s-maxage, 24h SWR) so
 * Cloudflare can serve from the edge with near-zero origin load.
 */
type PrivacyRouteData = { siteUrl?: string | undefined };

export const Route = createFileRoute("/_public/privacy")({
	ssr: true,
	loader: async () => {
		await setLegalPageCacheHeaders(
			new Headers({ "Cache-Control": LEGAL_PAGE_CACHE_CONTROL }),
		);
		const { publicEnv } = await import("#/lib/env/public");
		return { siteUrl: publicEnv.VITE_SITE_URL } satisfies PrivacyRouteData;
	},
	head: ({ loaderData }) => {
		const data = loaderData as PrivacyRouteData | undefined;
		return buildLegalPageHead({
			title: "Privacy Policy -- EventKart",
			description:
				"How EventKart collects, uses, retains, and protects participant data, with a DPDPA-aware data-minimization posture.",
			path: "/privacy",
			siteUrl: data?.siteUrl,
		});
	},
	component: PrivacyPage,
});
