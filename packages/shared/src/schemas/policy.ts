import { z } from "zod/v4";
import { ORGANIZER_POLICY_TYPES } from "../constants/policy.js";

const organizerPolicyTypeSchema = z.enum(ORGANIZER_POLICY_TYPES);

/**
 * Request schema for batch policy acceptance.
 * Clients send only the policy types they are accepting — the server
 * stamps the current version from CURRENT_POLICY_VERSIONS.
 */
export const policyAcceptanceRequestSchema = z.object({
	policies: z
		.array(organizerPolicyTypeSchema)
		.min(1, "At least one policy must be accepted")
		.refine(
			(arr) => new Set(arr).size === arr.length,
			"Duplicate policy types are not allowed",
		),
});

export type PolicyAcceptanceRequest = z.infer<
	typeof policyAcceptanceRequestSchema
>;

/** A single policy's acceptance status. */
export const policyStatusItemSchema = z.object({
	policyType: z.string(),
	currentVersion: z.string(),
	acceptedVersion: z.string().nullable(),
	isCurrentVersionAccepted: z.boolean(),
	acceptedAt: z.string().nullable(),
});

export type PolicyStatusItem = z.infer<typeof policyStatusItemSchema>;

/** Response schema for GET policy status. */
export const policyStatusResponseSchema = z.object({
	policies: z.array(policyStatusItemSchema),
	allRequiredAccepted: z.boolean(),
});

export type PolicyStatusResponse = z.infer<typeof policyStatusResponseSchema>;
