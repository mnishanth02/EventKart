import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import {
	LEGAL_PAGE_CACHE_CONTROL,
	setLegalPageCacheHeaders,
} from "#/features/legal-pages/cache-headers";
import { LegalPageLayout } from "#/features/legal-pages/components/legal-page-layout";
import { buildLegalPageHead } from "#/features/legal-pages/seo";

/**
 * Public /about page (I-2.5.4).
 *
 * SSR + CDN-cached so search engines can index the EventKart positioning,
 * mission, Coimbatore-pilot story, and "what EventKart is not" boundaries.
 * Copy is sourced verbatim or paraphrased from `docs/product-plan.md`
 * sections 1, 2, and 10 -- update both files together when the product
 * narrative shifts.
 *
 * Route is intentionally NOT a versioned legal document: we do not pass
 * `version` / `effectiveDate` to LegalPageLayout, so the metadata line
 * under the H1 stays hidden. Cache headers and `head()` follow the same
 * shape used by the sibling `/organizers/$slug` route, with `siteUrl`
 * threaded through the loader so the SEO helper can emit absolute
 * canonical / og:url / hreflang tags.
 */
type AboutRouteData = {
	siteUrl: string | undefined;
};

const PAGE_TITLE = "About EventKart -- Coimbatore's running community";
const PAGE_DESCRIPTION =
	"EventKart is the organizer-first platform for fitness events in India, piloting in Coimbatore with unified registration, payments, and check-in.";

export const Route = createFileRoute("/_public/about")({
	ssr: true,
	loader: async () => {
		await setLegalPageCacheHeaders(
			new Headers({ "Cache-Control": LEGAL_PAGE_CACHE_CONTROL }),
		);
		const { publicEnv } = await import("#/lib/env/public");
		return {
			siteUrl: publicEnv.VITE_SITE_URL,
		} satisfies AboutRouteData;
	},
	head: ({ loaderData }) => {
		const data = loaderData as AboutRouteData | undefined;
		return buildLegalPageHead({
			title: PAGE_TITLE,
			description: PAGE_DESCRIPTION,
			path: "/about",
			siteUrl: data?.siteUrl,
		});
	},
	component: AboutPage,
});

function AboutPage() {
	return (
		<LegalPageLayout title="About EventKart">
			<AboutContent />
		</LegalPageLayout>
	);
}

/**
 * Pure inner content for `/about`, exported so unit tests can render the
 * page body without booting the TanStack Router runtime. Mirrors the
 * `RegisterPlaceholder` split used by `/events/$slug/register`.
 */
export function AboutContent() {
	return (
		<>
			<h2>Our mission</h2>
			<p>
				Help fitness event organizers in India launch events with
				professional-grade tooling, eliminate manual registration-payment
				reconciliation, run clean event-day operations, build credibility
				through verification, and grow repeatable event businesses.
			</p>
			<p>
				Help fitness participants in India discover trustworthy events,
				register and pay in one seamless flow, receive instant confirmation,
				and gradually build a reusable event identity.
			</p>

			<h2>What EventKart is</h2>
			<p>
				EventKart is the organizer operating system for fitness events in
				India &mdash; starting with unified registration, payments, and
				event-day operations, with public discovery and participant identity
				compounding over time.
			</p>
			<p>
				For Indian fitness event organizers still running on Google Forms,
				payment links, WhatsApp, and spreadsheets, EventKart is the organizer
				system of record for paid fitness events. Unlike generic ticketing
				tools or broad event portals, EventKart unifies registration, payment,
				participant management, and event-day check-in in one India-first
				workflow, while using public event pages to support discovery and
				distribution.
			</p>

			<h2>Who we serve</h2>
			<h3>Organizers</h3>
			<p>
				Small to mid-sized Indian fitness event organizers are our first buyer
				and the primary success driver for V1. The ideal first organizer runs
				one to ten events a month, hosts fifty to two thousand participants per
				event, and is currently stitching together Google Forms, Razorpay,
				WhatsApp, and Excel. We are built for running clubs, boutique endurance
				brands, and active lifestyle communities ready to leave the
				payment-link era behind.
			</p>
			<h3>Participants</h3>
			<p>
				Participants are the end users of the booking flow and our long-term
				retention layer. They want trustworthy event information, one-step
				registration and payment, instant confirmation, a saved profile they
				do not re-enter every time, and confidence that the organizer is
				legitimate. EventKart is designed so every paid registration leaves
				behind a reusable identity instead of another lost form submission.
			</p>

			<h2>The Coimbatore pilot</h2>
			<p>
				We are starting in Coimbatore, with single-day paid running events,
				because density compounds faster than reach. When organizers and
				participants meet inside one city first, every new event makes the
				next event easier to fill, and every completed booking makes the next
				registration faster.
			</p>
			<p>
				Our density target for Coimbatore is to grow from a handful of
				organizers and ten-plus events in the first two months to fifteen-plus
				active organizers and thirty-plus events by month six. Crossing that
				threshold &mdash; not a vanity launch date &mdash; is what tells us
				the model is working.
			</p>
			<p>
				We will only expand to the next city after Coimbatore clears the bar:
				fifteen-plus active organizers, at least three of them having run
				three or more events on EventKart, demonstrated conversion improvement
				versus the old Google-Form-plus-payment-link flow, and split payout
				operations stable in production. Trust before territory.
			</p>

			<h2>From the team</h2>
			{/* TODO: ops can replace this with a personalized founder note once leadership chooses the voice. */}
			<p>
				EventKart was built because we kept seeing the same gap in Indian
				fitness events &mdash; organizers running on Google Forms and
				WhatsApp, participants chasing reconciliation receipts, and no place
				to build a real running history. We are starting small, with one city
				and one event type, because trust compounds slower than software and
				we would rather earn it event by event. If you are a Coimbatore
				organizer or runner, we would love to hear from you &mdash;{" "}
				<Link to="/contact">get in touch</Link>.
			</p>

			<h2>What EventKart is not</h2>
			<ul>
				<li>A wedding, concert, or entertainment ticketing platform</li>
				<li>A generic all-events marketplace</li>
				<li>A travel or hotel booking product</li>
				<li>A GPS tracking or workout logging app</li>
				<li>An enterprise white-label event stack</li>
				<li>A full social fitness network in V1</li>
			</ul>
		</>
	);
}
