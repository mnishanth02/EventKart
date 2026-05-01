import { publicEnv } from "#/lib/env/public";

/**
 * Support contact constants shared across the Module 2.5 static legal
 * and public pages (`/contact`, `/faq`, `/privacy`, `/terms`).
 *
 * The email is hard-coded because it is part of the EventKart product
 * surface and ships in legal copy. The phone number is intentionally
 * gated on `VITE_PUBLIC_SUPPORT_PHONE` and exposed via
 * {@link getSupportPhone}: the support phone is operations-defined,
 * may change per environment (staging vs production), and we MUST NOT
 * ship a placeholder phone number to production. If the env var is
 * unset (or whitespace-only) the helper returns `undefined` and pages
 * should hide the phone affordance entirely.
 */
export const SUPPORT_EMAIL = "support@eventkart.run";

/**
 * First-response SLA (in business days) advertised on `/contact` and
 * `/faq`. Sourced from product-plan §11 trust baseline — keep this in
 * sync with the SLA copy in those documents if it ever changes.
 */
export const SUPPORT_FIRST_RESPONSE_SLA_BUSINESS_DAYS = 2;

/**
 * Returns the public-facing support phone number, or `undefined` when
 * the env var is unset or whitespace-only. Pages MUST treat
 * `undefined` as "do not render a phone affordance" — never fall back
 * to a placeholder string. Operations sets `VITE_PUBLIC_SUPPORT_PHONE`
 * per environment.
 */
export function getSupportPhone(): string | undefined {
	const raw = publicEnv.VITE_PUBLIC_SUPPORT_PHONE;
	if (raw === undefined) return undefined;
	const trimmed = raw.trim();
	return trimmed.length === 0 ? undefined : trimmed;
}
