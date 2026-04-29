import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import type { EventPublicOrganizerSummary } from "../types";

export interface PublicEventPolicySectionProps {
	refundPolicy: string | null;
	cancellationPolicy: string | null;
	organizer: EventPublicOrganizerSummary;
}

/**
 * I-2.1.3 — Policy display.
 *
 * Renders refund + cancellation policies as **stacked subsections** so both
 * bodies are present in the SSR HTML (crawlable, printable, deep-linkable).
 * Three anchors are exposed for downstream booking/support deep links:
 *
 * - `#policies` (section wrapper)
 * - `#refund-policy` (refund subsection)
 * - `#cancellation-policy` (cancellation subsection)
 *
 * Both-null edge case (legacy/seed data; the I-1.2.5 publish gate normally
 * prevents this) renders an explicit fallback rather than silently omitting
 * the trust surface.
 *
 * Policy text is rendered as React text nodes only — no
 * `dangerouslySetInnerHTML`, no markdown, no link autodetection — so
 * organizer-authored content cannot inject DOM.
 */
export function PublicEventPolicySection({
	refundPolicy,
	cancellationPolicy,
	organizer,
}: PublicEventPolicySectionProps) {
	const hasRefund = refundPolicy !== null && refundPolicy.length > 0;
	const hasCancellation =
		cancellationPolicy !== null && cancellationPolicy.length > 0;

	if (!hasRefund && !hasCancellation) {
		return (
			<section
				id="policies"
				aria-labelledby="policies-heading"
				className="scroll-mt-24"
			>
				<Card>
					<CardHeader>
						<CardTitle>
							<h2
								id="policies-heading"
								className="font-display text-2xl font-semibold tracking-tight"
							>
								Before you book
							</h2>
						</CardTitle>
						<CardDescription>
							{organizer.businessName} has not published refund or cancellation
							policies for this event.
						</CardDescription>
					</CardHeader>
				</Card>
			</section>
		);
	}

	return (
		<section
			id="policies"
			aria-labelledby="policies-heading"
			className="scroll-mt-24"
		>
			<Card>
				<CardHeader>
					<CardTitle>
						<h2
							id="policies-heading"
							className="font-display text-2xl font-semibold tracking-tight"
						>
							Before you book
						</h2>
					</CardTitle>
					<CardDescription>
						Review {organizer.businessName}'s refund and cancellation terms
						before booking.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
					{hasRefund ? (
						<section
							id="refund-policy"
							aria-labelledby="refund-policy-heading"
							className="scroll-mt-24 space-y-2"
						>
							<h3
								id="refund-policy-heading"
								className="font-display text-base font-semibold text-foreground"
							>
								Refund policy
							</h3>
							<p className="whitespace-pre-line">{refundPolicy}</p>
						</section>
					) : null}
					{hasCancellation ? (
						<section
							id="cancellation-policy"
							aria-labelledby="cancellation-policy-heading"
							className="scroll-mt-24 space-y-2"
						>
							<h3
								id="cancellation-policy-heading"
								className="font-display text-base font-semibold text-foreground"
							>
								Cancellation policy
							</h3>
							<p className="whitespace-pre-line">{cancellationPolicy}</p>
						</section>
					) : null}
				</CardContent>
			</Card>
		</section>
	);
}
