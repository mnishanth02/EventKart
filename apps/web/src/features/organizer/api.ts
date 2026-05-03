/**
 * Organizer server functions — safe to import from any code.
 * Server-only helpers are dynamically imported to keep them out of
 * the client bundle.
 */

import type {
	OrganizerRegistrationInput,
	OrganizerUpdateInput,
} from "@repo/shared/schemas";
import { createServerFn } from "@tanstack/react-start";
import type {
	DocumentUploadRequest,
	OrganizerProfile,
	PolicyStatusResponse,
	PresignedUploadUrl,
	VerificationDocument,
	VerificationStatusResponse,
} from "./types";

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

/**
 * Server function to update the current user's organizer profile.
 * Uses POST for TanStack Start (only GET/POST supported), but the
 * actual API call in api.server.ts uses PUT.
 */
export const updateOrganizerProfile = createServerFn({ method: "POST" })
	.inputValidator((data: OrganizerUpdateInput) => data)
	.handler(async ({ data }): Promise<OrganizerProfile> => {
		const { updateOrganizerOnServer } = await import("./api.server");
		const response = await updateOrganizerOnServer(data);
		return response.data;
	});

// ── Document Upload Server Functions ────────────────────────────────

/**
 * Server function to request a presigned upload URL for a verification document.
 */
export const getDocumentUploadUrl = createServerFn({ method: "POST" })
	.inputValidator((data: DocumentUploadRequest) => data)
	.handler(async ({ data }): Promise<PresignedUploadUrl> => {
		const { requestDocumentUploadUrl } = await import("./api.server");
		const response = await requestDocumentUploadUrl(data);
		return response.data;
	});

/**
 * Server function to confirm a document upload after the file is in S3.
 */
export const confirmDocumentUpload = createServerFn({ method: "POST" })
	.inputValidator((data: { documentId: string }) => data)
	.handler(async ({ data }): Promise<VerificationDocument> => {
		const { confirmDocumentUploadOnServer } = await import("./api.server");
		const response = await confirmDocumentUploadOnServer(data.documentId);
		return response.data;
	});

/**
 * Server function to list all verification documents for the current organizer.
 */
export const getVerificationDocuments = createServerFn({
	method: "GET",
}).handler(async (): Promise<VerificationDocument[]> => {
	const { fetchVerificationDocuments } = await import("./api.server");
	const response = await fetchVerificationDocuments();
	return response.data;
});

/**
 * Server function to delete a verification document.
 * Uses POST for TanStack Start (only GET/POST supported), but the
 * actual API call in api.server.ts uses DELETE.
 */
export const deleteDocument = createServerFn({ method: "POST" })
	.inputValidator((data: { documentId: string }) => data)
	.handler(async ({ data }): Promise<void> => {
		const { deleteDocumentOnServer } = await import("./api.server");
		await deleteDocumentOnServer(data.documentId);
	});

// ── Verification Status Server Functions ────────────────────────────

/**
 * Server function to fetch the comprehensive verification status.
 * Returns the full status including steps, documents, and review info.
 */
export const getVerificationStatus = createServerFn({
	method: "GET",
}).handler(async (): Promise<VerificationStatusResponse | null> => {
	const { fetchVerificationStatus } = await import("./api.server");
	try {
		const response = await fetchVerificationStatus();
		return response.data;
	} catch {
		return null;
	}
});

// ── Browser-Only API Functions (Account Deletion) ───────────────────
//
// These use the browser apiClient directly (NOT createServerFn) because
// the DELETE POST must be a direct browser request so Set-Cookie clears
// (session cookie removal) propagate to the browser.

import { apiClient } from "#/lib/api-client";

export interface DeletionPreview {
	businessName: string;
	futureEvents: Array<{ title: string; startAt: string }>;
	preservedEventCount: number;
	hasRazorpayAccount: boolean;
	kycDocumentCount: number;
}

export interface DeletionResult {
	message: string;
	deletedEventCount: number;
	preservedEventCount: number;
}

/**
 * Fetches a preview of what will happen when the organizer account is deleted.
 * Browser-only — requires the session cookie to be sent from the browser.
 */
export async function getOrganizerDeletionPreview(): Promise<DeletionPreview> {
	return apiClient<DeletionPreview>("/organizers/me/deletion-preview");
}

/**
 * Permanently deletes the organizer account. The API clears the session cookie.
 * Browser-only — must run in the browser so cookie clears land correctly.
 */
export async function deleteOrganizerAccount(): Promise<DeletionResult> {
	return apiClient<DeletionResult>("/organizers/me/delete", {
		method: "POST",
	});
}
