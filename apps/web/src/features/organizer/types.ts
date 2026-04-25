import type {
	DocumentUploadRequest,
	OrganizerProfile,
	OrganizerUpdateInput,
	PolicyStatusResponse,
	PresignedUploadUrl,
	VerificationDocument,
	VerificationStatusResponse,
} from "@repo/shared/schemas";

export type {
	DocumentUploadRequest,
	OrganizerProfile,
	OrganizerUpdateInput,
	PolicyStatusResponse,
	PresignedUploadUrl,
	VerificationDocument,
	VerificationStatusResponse,
};

export type OrganizerProfileResponse = {
	success: true;
	data: OrganizerProfile;
};

export type OrganizerUpdateResponse = {
	success: true;
	data: OrganizerProfile;
};

export type PolicyStatusApiResponse = {
	success: true;
	data: PolicyStatusResponse;
};

export type PresignedUploadUrlResponse = {
	success: true;
	data: PresignedUploadUrl;
};

export type VerificationDocumentResponse = {
	success: true;
	data: VerificationDocument;
};

export type VerificationDocumentsListResponse = {
	success: true;
	data: VerificationDocument[];
};

export type DocumentDeleteResponse = {
	success: true;
	data: { deleted: true };
};

export type VerificationStatusApiResponse = {
	success: true;
	data: VerificationStatusResponse;
};
