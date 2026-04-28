import type {
	AdminApproveBody,
	AdminEventApproveBody,
	AdminEventRejectBody,
	AdminEventReviewActionResponse,
	AdminEventReviewDetail,
	AdminEventReviewListItem,
	AdminEventReviewListParams,
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
	AdminEventApproveBody,
	AdminEventRejectBody,
	AdminEventReviewActionResponse,
	AdminEventReviewDetail,
	AdminEventReviewListItem,
	AdminEventReviewListParams,
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

export type AdminEventReviewListResponse = {
	success: true;
	data: AdminEventReviewListItem[];
	meta: OffsetPaginationMeta;
};

export type AdminVerificationDetailResponse = {
	success: true;
	data: AdminVerificationDetail;
};

export type AdminEventReviewDetailResponse = {
	success: true;
	data: AdminEventReviewDetail;
};

export type DocumentViewUrlResponse = {
	success: true;
	data: DocumentViewUrl;
};

export type AdminReviewActionApiResponse = {
	success: true;
	data: AdminReviewActionResponse;
};

export type AdminEventReviewActionApiResponse = {
	success: true;
	data: AdminEventReviewActionResponse;
};
