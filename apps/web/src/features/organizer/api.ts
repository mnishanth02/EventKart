/**
 * Organizer server functions — safe to import from any code.
 * Server-only helpers are dynamically imported to keep them out of
 * the client bundle.
 */

import type { OrganizerRegistrationInput } from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import type { OrganizerProfile, PolicyStatusResponse } from "./types";

/**
 * Server function to register a new organizer profile.
 * Called from the registration form's onSubmit handler.
 */
export const registerOrganizer = createServerFn({ method: "POST" })
	.inputValidator((data: OrganizerRegistrationInput) => data)
	.handler(async ({ data }): Promise<OrganizerProfile> => {
		const { registerOrganizerOnServer } = await import("./api.server");
		const response = await registerOrganizerOnServer(data);
		return response.data;
	});

/**
 * Server function to fetch the current user's organizer profile.
 * Returns `null` when no profile exists yet.
 */
export const getOrganizerProfile = createServerFn({ method: "GET" }).handler(
	async (): Promise<OrganizerProfile | null> => {
		const { fetchOrganizerProfile } = await import("./api.server");
		const response = await fetchOrganizerProfile();
		return response?.data ?? null;
	},
);

/**
 * Server function to accept organizer policies.
 * Called from the policy acceptance form.
 */
export const acceptOrganizerPolicies = createServerFn({ method: "POST" })
	.inputValidator((data: { policies: string[] }) => data)
	.handler(async ({ data }): Promise<PolicyStatusResponse> => {
		const { acceptPoliciesOnServer } = await import("./api.server");
		const response = await acceptPoliciesOnServer(data);
		return response.data;
	});

/**
 * Server function to fetch the current organizer's policy acceptance status.
 * Returns `null` when no profile/policies exist yet.
 */
export const getOrganizerPolicyStatus = createServerFn({
	method: "GET",
}).handler(async (): Promise<PolicyStatusResponse | null> => {
	const { fetchPolicyStatus } = await import("./api.server");
	const response = await fetchPolicyStatus();
	return response?.data ?? null;
});
