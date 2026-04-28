import {
	EVENT_IMAGE_ALLOWED_CONTENT_TYPES,
	EVENT_IMAGE_MAX_SIZE_BYTES,
} from "@repo/shared/constants";
import type { EventImageContentType } from "@repo/shared/schemas";

export const EVENT_IMAGE_ACCEPT = EVENT_IMAGE_ALLOWED_CONTENT_TYPES.join(",");

export type EventImageValidationResult =
	| { valid: true; contentType: EventImageContentType }
	| { valid: false; message: string };

export function formatEventImageFileSize(
	bytes: number | null | undefined,
): string {
	if (bytes == null) return "Unknown size";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateEventImageFile(file: File): EventImageValidationResult {
	if (
		!EVENT_IMAGE_ALLOWED_CONTENT_TYPES.includes(
			file.type as EventImageContentType,
		)
	) {
		return {
			valid: false,
			message: "Only JPEG, PNG, and WebP images are accepted.",
		};
	}

	if (file.size > EVENT_IMAGE_MAX_SIZE_BYTES) {
		return {
			valid: false,
			message: `Image size must not exceed ${formatEventImageFileSize(EVENT_IMAGE_MAX_SIZE_BYTES)}.`,
		};
	}

	return { valid: true, contentType: file.type as EventImageContentType };
}
