/**
 * Server-only organizer API helpers.
 *
 * Uses the internal API client (INTERNAL_API_URL + X-Internal-Key).
 * Must NEVER be imported from client code — consumed via dynamic import
 * in `./api.ts` createServerFn handlers.
 */

import type {
	DocumentUploadRequest,
	OrganizerRegistrationInput,
	OrganizerUpdateInput,
} from "@repo/shared/schemas";
import { serverApiClient } from "#/lib/api-client.server";
import { getForwardedAuthHeaders } from "#/lib/auth/server-fns.server";
import type {
	DocumentDeleteResponse,
	OrganizerProfileResponse,
	OrganizerUpdateResponse,
	PolicyStatusApiResponse,
	PresignedUploadUrlResponse,
	VerificationDocumentResponse,
	VerificationDocumentsListResponse,
	VerificationStatusApiResponse,
} from "./types";

/**
 * Registers an organizer profile via POST /api/v1/organizers.
 * Forwards the user's session cookie for auth.
 */
export async function registerOrganizerOnServer(
	data: OrganizerRegistrationInput,
): Promise<OrganizerProfileResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<OrganizerProfileResponse>("/organizers", {
		method: "POST",
		body: data,
		headers,
	});
}

/**
 * Fetches the current user's organizer profile via GET /api/v1/organizers/me.
 * Returns `null` when no profile exists (404 from the API).
 */
export async function fetchOrganizerProfile(): Promise<OrganizerProfileResponse | null> {
	const headers = getForwardedAuthHeaders();

	try {
		return await serverApiClient<OrganizerProfileResponse>("/organizers/me", {
			headers,
		});
	} catch (error: unknown) {
		const { ApiClientError } = await import("#/lib/api-client.server");
		if (error instanceof ApiClientError && error.status === 404) {
			return null;
		}
		throw error;
	}
}

/**
 * Updates the current user's organizer profile via PUT /api/v1/organizers/me.
 * Only changed fields need to be included in the request body.
 */
export async function updateOrganizerOnServer(
	data: OrganizerUpdateInput,
): Promise<OrganizerUpdateResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<OrganizerUpdateResponse>("/organizers/me", {
		method: "PUT",
		body: data,
		headers,
	});
}

/**
 * Accepts organizer policies via POST /api/v1/organizers/policies.
 * Forwards the user's session cookie for auth.
 */
export async function acceptPoliciesOnServer(data: {
	policies: string[];
}): Promise<PolicyStatusApiResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<PolicyStatusApiResponse>("/organizers/policies", {
		method: "POST",
		body: data,
		headers,
	});
}

/**
 * Fetches the current organizer's policy acceptance status via GET /api/v1/organizers/policies.
 * Returns `null` when no profile/policies exist (404 from the API).
 */
export async function fetchPolicyStatus(): Promise<PolicyStatusApiResponse | null> {
	const headers = getForwardedAuthHeaders();
	try {
		return await serverApiClient<PolicyStatusApiResponse>(
			"/organizers/policies",
			{ headers },
		);
	} catch (error: unknown) {
		const { ApiClientError } = await import("#/lib/api-client.server");
		if (error instanceof ApiClientError && error.status === 404) {
			return null;
		}
		throw error;
	}
}

/**
 * Requests a presigned upload URL for a verification document.
 * POST /api/v1/organizers/documents/upload-url
 */
export async function requestDocumentUploadUrl(
	data: DocumentUploadRequest,
): Promise<PresignedUploadUrlResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<PresignedUploadUrlResponse>(
		"/organizers/documents/upload-url",
		{ method: "POST", body: data, headers },
	);
}

/**
 * Confirms a document upload after the file has been uploaded to S3.
 * POST /api/v1/organizers/documents/:documentId/confirm
 */
export async function confirmDocumentUploadOnServer(
	documentId: string,
): Promise<VerificationDocumentResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<VerificationDocumentResponse>(
		`/organizers/documents/${documentId}/confirm`,
		{ method: "POST", headers },
	);
}

/**
 * Fetches all verification documents for the current organizer.
 * GET /api/v1/organizers/documents
 */
export async function fetchVerificationDocuments(): Promise<VerificationDocumentsListResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<VerificationDocumentsListResponse>(
		"/organizers/documents",
		{ headers },
	);
}

/**
 * Deletes a verification document.
 * DELETE /api/v1/organizers/documents/:documentId
 */
export async function deleteDocumentOnServer(
	documentId: string,
): Promise<DocumentDeleteResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<DocumentDeleteResponse>(
		`/organizers/documents/${documentId}`,
		{ method: "DELETE", headers },
	);
}

/**
 * Fetches the comprehensive verification status for the current organizer.
 * GET /api/v1/organizers/verification-status
 */
export async function fetchVerificationStatus(): Promise<VerificationStatusApiResponse> {
	const headers = getForwardedAuthHeaders();
	return serverApiClient<VerificationStatusApiResponse>(
		"/organizers/verification-status",
		{ headers },
	);
}
