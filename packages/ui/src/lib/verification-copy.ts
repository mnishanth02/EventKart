/**
 * Single source of truth for the verification-status explanation copy
 * (I-2.3.4).
 *
 * Wording mirrors `docs/requirements.md` §4.1 verbatim: verification is
 * an onboarding and policy check, NOT a guarantee of event quality,
 * safety, or specific outcomes. Do not add liability claims, support
 * routing, or other language not in the spec — separate copy
 * requirements (e.g. §4.1 "report issues to EventKart support") belong
 * to dedicated future surfaces.
 */
export const VERIFICATION_EXPLANATION = {
	triggerLabel: "What does verified mean?",
	heading: "Verification is an onboarding check",
	body: "EventKart verifies organizers' business details and refund/cancellation policies during onboarding. Verification is not a guarantee of event quality, safety, or specific outcomes.",
} as const;
