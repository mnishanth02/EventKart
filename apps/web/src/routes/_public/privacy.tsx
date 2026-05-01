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

/**
 * Pure page component. Exported so unit tests can render the body
 * directly without booting the TanStack Router runtime, mirroring the
 * `RegisterPlaceholder` split in `events/$slug/register.tsx`.
 */
export function PrivacyPage() {
	const dsarMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
		"Data subject request",
	)}`;

	return (
		<LegalPageLayout
			title="Privacy Policy"
			version={PARTICIPANT_LEGAL_VERSIONS.privacy}
			effectiveDate="2026-05-01"
		>
			<p>
				EventKart follows a DPDPA-aware privacy posture built on data
				minimization, purpose limitation, and consent at collection. We
				ask only for what we need to register you for an event, manage
				your booking, and run the event day -- nothing more.
			</p>

			<h2>1. Data we collect</h2>
			<p>
				The table below covers the participant-facing data classes we
				handle. Organizer KYC documents (Aadhaar, PAN, GST certificate,
				bank proof) are stored separately and are not part of
				participant booking data.
			</p>
			<table>
				<thead>
					<tr>
						<th>Data class</th>
						<th>Examples</th>
						<th>Access</th>
						<th>Retention</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Participant profile</td>
						<td>Name, phone, email, age, gender, city</td>
						<td>Participant + booked organizers</td>
						<td>Until account deletion or 3 years of inactivity</td>
					</tr>
					<tr>
						<td>Booking data</td>
						<td>Event, category, payment status, QR ticket</td>
						<td>Participant + organizer + EventKart ops</td>
						<td>5 years for financial and audit needs</td>
					</tr>
					<tr>
						<td>Sensitive participant fields</td>
						<td>
							Emergency contact, blood group, medical conditions
						</td>
						<td>
							Participant + organizer on event-day workflows only
						</td>
						<td>
							Delete 30 days after event completion unless legally
							required otherwise
						</td>
					</tr>
					<tr>
						<td>Payment data</td>
						<td>Transaction ID, amount, split details</td>
						<td>EventKart ops + payment gateway</td>
						<td>5 years for financial and audit needs</td>
					</tr>
				</tbody>
			</table>

			<h2>2. How we use your data</h2>
			<ul>
				<li>
					<strong>Data minimization.</strong> We collect only what is
					needed for registration and event-day operations.
				</li>
				<li>
					<strong>Sensitive fields are opt-in by default.</strong>{" "}
					Medical conditions and blood group are optional unless the
					organizer provides a safety reason for requiring them.
				</li>
				<li>
					<strong>Consent at collection.</strong> Participants
					explicitly consent at booking submission. There are no
					pre-checked boxes.
				</li>
				<li>
					<strong>Scoped organizer access.</strong> Organizers see
					only participant data for their own events. Sensitive
					fields are restricted to event-day workflows and offline
					fallback where needed.
				</li>
				<li>
					<strong>Separate storage for verification docs.</strong>{" "}
					Organizer KYC documents are stored separately from
					participant booking data.
				</li>
				<li>
					<strong>Deletion rights.</strong> Participant profile data
					can be deleted on request; booking records may be
					anonymized rather than erased where financial records must
					be retained.
				</li>
				<li>
					<strong>DPDPA-aware posture.</strong> EventKart V1 follows
					data minimization, purpose limitation, and consent
					principles aligned with India's Digital Personal Data
					Protection Act.
				</li>
			</ul>

			<h2>3. Retention windows</h2>
			<p>
				In plain language, the retention windows summarized in the
				table above are:
			</p>
			<ul>
				<li>
					<strong>Participant profile:</strong> kept until you delete
					your account, or until your account has been inactive for
					3 years.
				</li>
				<li>
					<strong>Booking data and payment data:</strong> kept for 5
					years to meet financial and audit needs.
				</li>
				<li>
					<strong>Sensitive event-day fields:</strong> deleted 30
					days after the event completes, unless we are legally
					required to retain them for longer.
				</li>
			</ul>

			<h2>4. Your rights</h2>
			<ul>
				<li>
					<strong>Access.</strong> Request a copy of the participant
					data we hold about you.
				</li>
				<li>
					<strong>Correction.</strong> Ask us to correct inaccurate
					profile information.
				</li>
				<li>
					<strong>Deletion.</strong> Request deletion of your
					participant profile. Where financial records must be
					retained, the related booking records may be anonymized
					rather than fully erased.
				</li>
				<li>
					<strong>Withdraw consent.</strong> Withdraw consent for
					future processing at any time. Withdrawal does not affect
					processing already carried out lawfully.
				</li>
			</ul>
			<h3>How to exercise your rights</h3>
			<p>
				Email{" "}
				<a href={dsarMailto}>{SUPPORT_EMAIL}</a> with the prefilled
				subject "Data subject request". We will acknowledge your
				request and confirm next steps.
			</p>
			{/* TODO(I-7.3.8): replace mailto with the dedicated DSAR self-service flow once shipped. */}

			<h2>5. Consent</h2>
			<p>
				Consent is captured explicitly at booking submission, with no
				pre-checked boxes. You will see exactly what you are agreeing
				to before you submit a booking, and the version of this
				Privacy Policy you accepted is recorded with your booking.
			</p>

			<h2>6. Event-day handling</h2>
			<p>
				Offline rosters carry only the minimum data needed to run the
				event. Sensitive medical disclosures appear on offline rosters
				only when marked safety-critical. Offline roster exports
				include a delete-after-event handling instruction. QR check-in
				does not expose sensitive fields by default on screen.
			</p>

			<h2>7. Data security and incidents</h2>
			<p>
				EventKart V1 prioritizes prevention through access control,
				data minimization, and logging of access to organizer
				verification documents and sensitive participant data.
			</p>
			<p>
				If a security incident occurs, EventKart follows applicable
				notification requirements, including regulator or CERT-In
				reporting where required.
			</p>

			<h2>8. Contact</h2>
			<p>
				Questions about this policy? Email{" "}
				<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See
				also our <Link to="/terms">Terms of Service</Link> and{" "}
				<Link to="/contact">contact options</Link>.
			</p>
		</LegalPageLayout>
	);
}
