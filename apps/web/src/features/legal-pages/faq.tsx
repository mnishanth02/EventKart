import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LegalPageLayout } from "#/features/legal-pages/components/legal-page-layout";
import {
	SUPPORT_EMAIL,
	SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS,
} from "#/features/legal-pages/constants";

export interface FaqItem {
	id: string;
	question: string;
	answer: ReactNode;
	plainTextAnswer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
	{
		id: "how-booking-works",
		question: "How does booking work?",
		answer: (
			<>
				<p>
					Browse events without signing in. Pick the event you want, choose your
					category, and fill in your details. We send a one-time password (OTP)
					to your phone to verify your identity at the moment you submit the
					booking — no password or account creation needed up front.
				</p>
				<p>
					Pay via UPI or card through our payment gateway. The moment payment
					succeeds you receive an email confirmation with your QR ticket.
				</p>
			</>
		),
		plainTextAnswer:
			"Browse events without signing in. Pick the event you want, choose your category, and fill in your details. We send a one-time password (OTP) to your phone to verify your identity at the moment you submit the booking — no password or account creation needed up front. Pay via UPI or card through our payment gateway. The moment payment succeeds you receive an email confirmation with your QR ticket.",
	},
	{
		id: "view-past-booking",
		question: "How do I view a past booking?",
		answer: (
			<>
				<p>
					Your booking confirmation email contains a direct link to your booking
					— that link is the fastest way back to your ticket and details.
				</p>
				<p>
					If you have lost the email, you will be able to look up a booking by
					phone number plus booking reference (with a one-time password) once
					that flow ships in a future release. In the meantime, please email{" "}
					<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your
					booking reference and we will help you locate it.
				</p>
				{/* TODO(I-3.3.8): replace this paragraph with a link to the booking-lookup page once Phase 3 lands. */}
			</>
		),
		plainTextAnswer:
			"Your booking confirmation email contains a direct link to your booking — that link is the fastest way back to your ticket and details. If you have lost the email, you will be able to look up a booking by phone number plus booking reference (with a one-time password) once that flow ships in a future release. In the meantime, please email " +
			SUPPORT_EMAIL +
			" with your booking reference and we will help you locate it.",
	},
	{
		id: "refund-process",
		question: "What is the refund process?",
		answer: (
			<>
				<p>
					Each event sets its own refund and cancellation policy. The policy
					that applies to your booking is the one displayed on the event page at
					the time you booked — it is part of your booking record and does not
					change retroactively.
				</p>
				<p>
					To request a refund, contact the organizer first using the contact
					details on the event page. If the issue is unresolved, email EventKart
					support at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> —
					our first-response target is{" "}
					{SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS} business days. See our{" "}
					<Link to="/terms">Terms</Link> for the full dispute framework.
				</p>
			</>
		),
		plainTextAnswer:
			"Each event sets its own refund and cancellation policy. The policy that applies to your booking is the one displayed on the event page at the time you booked — it is part of your booking record and does not change retroactively. To request a refund, contact the organizer first using the contact details on the event page. If the issue is unresolved, email EventKart support at " +
			SUPPORT_EMAIL +
			" — our first-response target is " +
			String(SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS) +
			" business days. See our Terms for the full dispute framework.",
	},
	{
		id: "event-day",
		question: "What happens on event day?",
		answer: (
			<>
				<p>
					Show your QR ticket at the organizer's check-in. You can show it
					straight from the confirmation email or save the QR image to your
					phone in advance — either works.
				</p>
				<p>
					Sensitive fields you provided at booking (such as blood group or
					medical conditions) are visible only to the organizer's event-day
					staff and only on offline rosters where they are needed. After the
					event, sensitive event-day data is removed within 30 days unless we
					are legally required to retain it longer.
				</p>
			</>
		),
		plainTextAnswer:
			"Show your QR ticket at the organizer's check-in. You can show it straight from the confirmation email or save the QR image to your phone in advance — either works. Sensitive fields you provided at booking (such as blood group or medical conditions) are visible only to the organizer's event-day staff and only on offline rosters where they are needed. After the event, sensitive event-day data is removed within 30 days unless we are legally required to retain it longer.",
	},
	{
		id: "data-safe",
		question: "Is my data safe?",
		answer: (
			<>
				<p>
					We follow a DPDPA-aware posture built on three principles: data
					minimization (we only collect what the booking and event-day
					operations need), purpose limitation (we use your data only for those
					purposes), and explicit consent captured at booking submission.
				</p>
				<p>
					Sensitive fields are opt-in by default unless the organizer provides a
					documented safety reason for requiring them. Full detail on what we
					collect, how long we keep it, and your rights is in our{" "}
					<Link to="/privacy">Privacy Policy</Link>.
				</p>
			</>
		),
		plainTextAnswer:
			"We follow a DPDPA-aware posture built on three principles: data minimization (we only collect what the booking and event-day operations need), purpose limitation (we use your data only for those purposes), and explicit consent captured at booking submission. Sensitive fields are opt-in by default unless the organizer provides a documented safety reason for requiring them. Full detail on what we collect, how long we keep it, and your rights is in our Privacy Policy.",
	},
];

export interface FaqQuestionJsonLd {
	"@type": "Question";
	name: string;
	acceptedAnswer: {
		"@type": "Answer";
		text: string;
	};
}

export interface FaqPageJsonLd {
	"@context": "https://schema.org";
	"@type": "FAQPage";
	mainEntity: FaqQuestionJsonLd[];
}

export function buildFaqPageJsonLd(
	items: readonly FaqItem[] = FAQ_ITEMS,
): FaqPageJsonLd {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.plainTextAnswer,
			},
		})),
	};
}

export function FaqPageView({ items }: { items: readonly FaqItem[] }) {
	return (
		<LegalPageLayout title="Frequently Asked Questions">
			<p>
				Quick answers to the questions runners and event-goers ask us most
				often. Still stuck? <Link to="/contact">Contact our support team</Link>{" "}
				or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
			</p>
			<Accordion
				type="multiple"
				className="not-prose mt-6 w-full"
				defaultValue={items.map((item) => item.id)}
			>
				{items.map((item) => (
					<AccordionItem key={item.id} value={item.id}>
						<AccordionTrigger>
							<span className="font-display font-semibold text-base md:text-lg">
								{item.question}
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<div className="prose prose-neutral max-w-none dark:prose-invert">
								{item.answer}
							</div>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</LegalPageLayout>
	);
}
