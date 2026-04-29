import { z } from "zod/v4";
import {
	EVENT_IMAGE_MAX_SIZE_BYTES,
	eventImageContentTypeSchema,
	eventImageKindSchema,
	eventImageStatusSchema,
} from "../constants/event.js";
import { datetimeSchema } from "./date.js";
import { uuidSchema } from "./id.js";

export type {
	EventImageContentType,
	EventImageKind,
	EventImageStatus,
} from "../constants/event.js";
export {
	eventImageContentTypeSchema,
	eventImageKindSchema,
	eventImageStatusSchema,
} from "../constants/event.js";

export const eventImageFileNameSchema = z
	.string()
	.trim()
	.min(1, "File name is required")
	.max(255, "File name must not exceed 255 characters");

export const eventImageSizeBytesSchema = z
	.number()
	.int("Image size must be a whole number of bytes")
	.min(1, "Image size must be at least 1 byte")
	.max(
		EVENT_IMAGE_MAX_SIZE_BYTES,
		`Image size must not exceed ${EVENT_IMAGE_MAX_SIZE_BYTES} bytes`,
	);

export const eventImageUploadUrlRequestSchema = z.object({
	kind: eventImageKindSchema,
	fileName: eventImageFileNameSchema,
	contentType: eventImageContentTypeSchema,
	sizeBytes: eventImageSizeBytesSchema,
});

export const eventImageUploadUrlResponseSchema = z.object({
	imageId: uuidSchema,
	url: z.string().url(),
	method: z.literal("POST"),
	fields: z.record(z.string(), z.string()),
	key: z.string().min(1),
	expiresAt: datetimeSchema,
});

export const eventImageConfirmRequestSchema = z.object({
	imageId: uuidSchema,
});

export const eventImageDeleteRequestSchema = z.object({
	imageId: uuidSchema,
});

export const eventImageListQuerySchema = z.object({
	kind: eventImageKindSchema.optional(),
	status: eventImageStatusSchema.optional(),
});

export const eventImageSchema = z.object({
	id: uuidSchema,
	eventId: uuidSchema,
	kind: eventImageKindSchema,
	fileName: z.string(),
	contentType: eventImageContentTypeSchema,
	sizeBytes: eventImageSizeBytesSchema.nullable(),
	storageKey: z.string(),
	status: eventImageStatusSchema,
	uploadedBy: uuidSchema,
	createdAt: datetimeSchema,
	updatedAt: datetimeSchema,
});

export const eventImagesResponseSchema = z.object({
	images: z.array(eventImageSchema),
});

export type EventImageUploadUrlRequest = z.infer<
	typeof eventImageUploadUrlRequestSchema
>;
export type EventImageUploadUrlResponse = z.infer<
	typeof eventImageUploadUrlResponseSchema
>;
export type EventImageConfirmRequest = z.infer<
	typeof eventImageConfirmRequestSchema
>;
export type EventImageDeleteRequest = z.infer<
	typeof eventImageDeleteRequestSchema
>;
export type EventImageListQuery = z.infer<typeof eventImageListQuerySchema>;
export type EventImage = z.infer<typeof eventImageSchema>;
export type EventImagesResponse = z.infer<typeof eventImagesResponseSchema>;
