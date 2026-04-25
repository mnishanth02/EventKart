import type {
	AdminApproveBody,
	AdminRejectBody,
	AdminReviewActionResponse,
	AdminVerificationDetail,
	AdminVerificationListItem,
	AdminVerificationListParams,
	DocumentViewUrl,
	OffsetPaginationMeta,
} from "@repo/shared/schemas";

export type {
	AdminApproveBody,
	AdminRejectBody,
	AdminReviewActionResponse,
	AdminVerificationDetail,
	AdminVerificationListItem,
	AdminVerificationListParams,
	DocumentViewUrl,
};

// ── API response wrappers ──────────────────────────────────────────

export type AdminVerificationListResponse = {
	success: true;
	data: AdminVerificationListItem[];
	meta: OffsetPaginationMeta;
};

export type AdminVerificationDetailResponse = {
	success: true;
	data: AdminVerificationDetail;
};

export type DocumentViewUrlResponse = {
	success: true;
	data: DocumentViewUrl;
};

export type AdminReviewActionApiResponse = {
	success: true;
	data: AdminReviewActionResponse;
};
