import { z } from "zod/v4";

/** Policy types that organizers must accept before verification can advance. */
export const ORGANIZER_POLICY_TYPES = [
	"platform_terms",
	"refund_policy",
] as const;

export type OrganizerPolicyType = (typeof ORGANIZER_POLICY_TYPES)[number];

export const organizerPolicyTypeSchema = z.enum(ORGANIZER_POLICY_TYPES);

/**
 * Current policy versions — the server is the source of truth.
 * When a policy is updated, bump the version here. Organizers must
 * re-accept the new version for their acceptance to remain valid.
 */
export const CURRENT_POLICY_VERSIONS: Record<OrganizerPolicyType, string> = {
	platform_terms: "1.0",
	refund_policy: "1.0",
} as const;

/** All organizer policy types are required for verification advancement. */
export const REQUIRED_ORGANIZER_POLICIES: readonly OrganizerPolicyType[] =
	ORGANIZER_POLICY_TYPES;

/** Human-readable labels for policy types. */
export const ORGANIZER_POLICY_LABELS: Record<OrganizerPolicyType, string> = {
	platform_terms: "Platform Terms & Conditions",
	refund_policy: "Refund Policy Framework",
} as const;
