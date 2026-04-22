export interface ApiSuccessResponse<T> {
	success: true;
	data: T;
}

export interface ApiErrorDetail {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
	success: false;
	error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface OffsetPaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface CursorPaginationMeta {
	nextCursor: string | null;
	hasMore: boolean;
	limit: number;
}

export interface PaginatedResponse<T> {
	success: true;
	data: T[];
	meta: OffsetPaginationMeta;
}

export interface CursorPaginatedResponse<T> {
	success: true;
	data: T[];
	meta: CursorPaginationMeta;
}
