import type {
	OrganizerProfile,
	PolicyStatusResponse,
	PresignedUploadUrl,
	VerificationDocument,
	DocumentUploadRequest,
} from "@repo/shared/schemas";

export type {
	OrganizerProfile,
	PolicyStatusResponse,
	PresignedUploadUrl,
	VerificationDocument,
	DocumentUploadRequest,
};

export type OrganizerProfileResponse = {
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
