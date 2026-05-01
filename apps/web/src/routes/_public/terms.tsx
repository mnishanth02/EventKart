import { PARTICIPANT_LEGAL_VERSIONS } from "@repo/shared/constants";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	LEGAL_PAGE_CACHE_CONTROL,
	setLegalPageCacheHeaders,
} from "#/features/legal-pages/cache-headers";
import { LegalPageLayout } from "#/features/legal-pages/components/legal-page-layout";
import { SUPPORT_EMAIL } from "#/features/legal-pages/constants";
import { buildLegalPageHead } from "#/features/legal-pages/seo";

/**
 * I-2.5.2 -- SSR Terms of Service page.
 *
 * Versioned to align with `consent_records.consent_version` for the
 * `booking_terms` document family. The displayed `Version` label is
 * sourced from `PARTICIPANT_LEGAL_VERSIONS.terms` (single source of
 * truth in `@repo/shared/constants`); when that constant is bumped the
 * Phase 3 booking flow will require explicit re-acceptance on the next
 * submission.
 *
 * SSR + CDN-cached via `setLegalPageCacheHeaders` so the page is served
 * from Cloudflare for anonymous discovery traffic. The loader returns
 * `siteUrl` so `head()` can emit absolute canonical / og:url tags
 * without reaching back into the env layer.
 */
type TermsRouteData = {
	siteUrl: string | undefined;
};

export const Route = createFileRoute("/_public/terms")({
	ssr: true,
	loader: async (): Promise<TermsRouteData> => {
		await setLegalPageCacheHeaders(
			new Headers({ "Cache-Control": LEGAL_PAGE_CACHE_CONTROL }),
		);
		const { publicEnv } = await import("#/lib/env/public");
		return { siteUrl: publicEnv.VITE_SITE_URL };
	},
	head: ({ loaderData }) => {
		const data = loaderData as TermsRouteData | undefined;
		return buildLegalPageHead({
			title: "Terms of Service — EventKart",
			description:
				"EventKart terms covering booking, payments, refund framework, organizer responsibilities, and acceptable use.",
			path: "/terms",
			siteUrl: data?.siteUrl,
		});
	},
	component: TermsPage,
});

function TermsPage() {
	return <TermsContent />;
}

/**
 * Pure inner component split out from the route `component` so unit
 * tests can render the page body without booting the TanStack Router
 * runtime. Mirrors the `RegisterPlaceholder` split in
 * `/events/$slug/register.tsx`.
 */
export function TermsContent() {
	const version = PARTICIPANT_LEGAL_VERSIONS.terms;
	return (
		<LegalPageLayout
			title="Terms of Service"
			version={version}
			effectiveDate="2026-05-01"
		>
			<p>
				These terms govern your use of EventKart. By booking an event, you
				accept the version of these terms current at booking time. We will ask
				you to re-accept whenever the version is bumped.
			</p>

			<h2>1. Acceptance of terms</h2>
			<p>
				When you submit a booking, we record the version you accepted —{" "}
				<strong>Version {version}</strong> at the time of writing — alongside
				your booking, so a later change does not change what you agreed to.
			</p>

			<h2>2. Eligibility</h2>
			<p>
				You must be 18 or older to book an event on your own behalf. Bookings on
				behalf of a minor require parental or guardian consent at booking time,
				including a guardian email captured as part of the registration form.
			</p>

			<h2>3. Account &amp; identity</h2>
			<p>
				Browsing EventKart does not require an account. We verify your identity
				via a phone OTP only at booking submission, not at signup. You do not
				need to create or maintain a public profile to discover or review
				events.
			</p>

			<h2>4. Booking, payment, and fees</h2>
			<p>
				EventKart processes payments through a regulated payment gateway
				(Razorpay or Cashfree) using a payment-time split payout: the organizer
				receives the event amount minus the EventKart platform fee, and
				EventKart receives its fee directly from the same transaction. Your
				booking is confirmed only after the payment succeeds; if payment fails
				or is reversed, the booking is not confirmed and any reserved spot is
				released.
			</p>

			<h2>5. Refund and cancellation framework</h2>
			<p>
				Each event sets its own refund and cancellation policy. The policy that
				applies to your booking is the one displayed on the event page at the
				time you book — that exact policy text is recorded with your booking
				record. EventKart enforces that organizers display these policies on the
				event page and stamp them at booking time, but the specific terms
				(refund windows, partial refunds, no-show treatment) are set by the
				organizer.
			</p>
			<p>
				For a refund or cancellation request, contact the organizer first using
				the contact details on the event page. If the organizer does not respond
				or the dispute remains unresolved, contact EventKart support — see our{" "}
				<Link to="/contact">contact page</Link> — and review how we handle
				dispute data on our <Link to="/privacy">privacy page</Link>.
			</p>

			<h2>6. Organizer responsibilities</h2>
			<p>
				Organizers are subject to verification before paid events go live. The
				first three paid events from a new organizer require manual review by
				EventKart before publish during the pilot. Organizers are responsible
				for the accuracy of the event details, pricing, refund and cancellation
				policy, and for delivering the event as described.
			</p>

			<h2>7. Acceptable use</h2>
			<p>
				Do not use EventKart to defraud other users, harass attendees or
				organizers, or violate Indian law. Repeated organizer policy violations
				or substantiated participant complaints may trigger suspension of the
				offending account.
			</p>

			<h2>8. Disclaimer &amp; liability boundaries</h2>
			<p>
				EventKart's verification of organizers is an onboarding and policy check
				— it is not a guarantee of event quality, safety, or specific outcomes
				at any individual event. To use the exact wording from our policy:
				Verification must be explained as a EventKart onboarding and policy
				check, not a blanket guarantee of event quality or safety.
			</p>
			<p>
				EventKart's liability to you in connection with any event is limited to
				the booking amount you paid through EventKart for that event.
			</p>

			<h2>9. Changes to terms</h2>
			<p>
				When we update these terms in a way that requires fresh consent, we bump
				the version. Your next booking after a version bump will require
				explicit re-acceptance of the new version before submission — the prior
				version remains the version of record for bookings made before the
				change.
			</p>

			<h2>10. Governing law</h2>
			<p>These terms are governed by the laws of India.</p>

			<p>
				Questions about these terms? Reach us via our{" "}
				<Link to="/contact">contact page</Link> or email{" "}
				<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
			</p>
		</LegalPageLayout>
	);
}
