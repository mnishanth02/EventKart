import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	LEGAL_PAGE_CACHE_CONTROL,
	setLegalPageCacheHeaders,
} from "#/features/legal-pages/cache-headers";
import { LegalPageLayout } from "#/features/legal-pages/components/legal-page-layout";
import {
	getSupportPhone,
	SUPPORT_EMAIL,
	SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS,
} from "#/features/legal-pages/constants";
import { buildLegalPageHead } from "#/features/legal-pages/seo";

/**
 * I-2.5.3 — `/contact` SSR page.
 *
 * Ships the email-and-phone fallback per docs/v1-implementation-plan.md
 * row 549. The embedded public dispute form is a Phase 7 deliverable
 * (I-7.2.5) — only the placeholder copy + TODO marker live here today.
 *
 * The loader resolves `getSupportPhone()` server-side and forwards it
 * through `useLoaderData()` so the SSR markup stays deterministic and
 * the React tree never reads `publicEnv` at render time. Cache headers
 * mirror the rest of Module 2.5 via `setLegalPageCacheHeaders`.
 */
export const Route = createFileRoute("/_public/contact")({
	ssr: true,
	loader: async () => {
		const { publicEnv } = await import("#/lib/env/public");
		await setLegalPageCacheHeaders(
			new Headers({ "Cache-Control": LEGAL_PAGE_CACHE_CONTROL }),
		);
		return {
			siteUrl: publicEnv.VITE_SITE_URL,
			supportPhone: getSupportPhone() ?? null,
		};
	},
	head: ({ loaderData }) =>
		buildLegalPageHead({
			title: "Contact — EventKart",
			description:
				"Contact EventKart support by email — we aim to send a first response within 2 business days.",
			path: "/contact",
			siteUrl: loaderData?.siteUrl,
		}),
	component: ContactPage,
});

function ContactPage() {
	const data = Route.useLoaderData();
	return (
		<LegalPageLayout title="Contact us">
			<ContactContent supportPhone={data.supportPhone} />
		</LegalPageLayout>
	);
}

export interface ContactContentProps {
	supportPhone: string | null;
}

/**
 * Inner content for `/contact`. Exported separately so unit tests can
 * render it directly with mock `supportPhone` props without booting
 * the TanStack Router runtime or stubbing `publicEnv` (mirrors
 * `RegisterPlaceholder` in `events/$slug/register.tsx`).
 */
export function ContactContent({ supportPhone }: ContactContentProps) {
	const telHref =
		supportPhone !== null ? `tel:${supportPhone.replace(/\s+/g, "")}` : null;

	return (
		<>
			<p>
				We are a small team. The fastest way to reach us is by email — we
				typically reply within {SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS}{" "}
				business days.
			</p>

			<div className="not-prose my-8">
				<Card>
					<CardHeader>
						<CardTitle>Email</CardTitle>
					</CardHeader>
					<CardContent>
						<a
							href={`mailto:${SUPPORT_EMAIL}`}
							className="text-lg font-semibold underline underline-offset-4 decoration-2 hover:no-underline"
						>
							{SUPPORT_EMAIL}
						</a>
					</CardContent>
				</Card>
			</div>

			<h2>Phone</h2>
			{supportPhone !== null && telHref !== null ? (
				<>
					<p>
						<a href={telHref}>{supportPhone}</a>
					</p>
					<p>
						Phone support is available during Indian business hours (Monday to
						Friday, IST).
					</p>
				</>
			) : (
				<p>
					Phone support is coming soon. In the meantime, please email us at the
					address above and we will get back to you within{" "}
					{SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS} business days.
				</p>
			)}

			<h2>Response time</h2>
			<p>
				We aim to send a first response to all support requests within{" "}
				{SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS} business days. Disputes about
				a specific event follow the same SLA — see the refund framework in our{" "}
				<Link to="/terms">Terms</Link>.
			</p>

			<h2>What to include in your request</h2>
			<ul>
				<li>
					Your booking reference (if you are writing about a specific booking)
				</li>
				<li>The event name and date</li>
				<li>
					A short description of the issue and what outcome you are looking for
				</li>
				<li>A contact phone number, if it is different from your email</li>
			</ul>

			<h2>Reporting an issue with an organizer</h2>
			<p>
				If your issue is with how an organizer ran an event, please contact the
				organizer first using the contact details on the event page. If the
				issue is not resolved, escalate to EventKart support at the email above.
			</p>

			{/* TODO(I-7.2.5): mount the public dispute reporting form here in Phase 7. The form is the I-7.2.5 deliverable; this page is its mount point. */}
			<p className="text-muted-foreground text-sm">
				A public dispute reporting form will be added to this page soon.
			</p>
		</>
	);
}
