import { describe, expect, it } from "vitest";
import {
	EVENT_IMAGE_ALLOWED_CONTENT_TYPES,
	EVENT_IMAGE_MAX_SIZE_BYTES,
	eventImageKindSchema,
	eventImageStatusSchema,
} from "../../src/constants/event";
import {
	eventImageSchema,
	eventImagesResponseSchema,
	eventImageUploadUrlRequestSchema,
	eventImageUploadUrlResponseSchema,
} from "../../src/schemas/event-image";

const imageId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const uploadedBy = "33333333-3333-4333-8333-333333333333";
const createdAt = "2026-04-26T12:00:00.000Z";

describe("event image constants", () => {
	it.each(["hero", "route_map"])("accepts image kind %s", (kind) => {
		expect(eventImageKindSchema.safeParse(kind).success).toBe(true);
	});

	it.each([
		"banner",
		"route-map",
		"thumbnail",
		"",
	])("rejects invalid image kind %s", (kind) => {
		expect(eventImageKindSchema.safeParse(kind).success).toBe(false);
	});

	it.each([
		"pending",
		"uploaded",
		"replaced",
		"deleted",
	])("accepts image status %s", (status) => {
		expect(eventImageStatusSchema.safeParse(status).success).toBe(true);
	});
});

describe("eventImageUploadUrlRequestSchema", () => {
	it.each(
		EVENT_IMAGE_ALLOWED_CONTENT_TYPES,
	)("accepts allowed MIME type %s", (contentType) => {
		const result = eventImageUploadUrlRequestSchema.parse({
			kind: "hero",
			fileName: "hero.jpg",
			contentType,
			sizeBytes: EVENT_IMAGE_MAX_SIZE_BYTES,
		});

		expect(result.contentType).toBe(contentType);
	});

	it.each([
		"image/gif",
		"application/pdf",
		"text/plain",
	])("rejects disallowed MIME type %s", (contentType) => {
		const result = eventImageUploadUrlRequestSchema.safeParse({
			kind: "hero",
			fileName: "hero.gif",
			contentType,
			sizeBytes: 1024,
		});

		expect(result.success).toBe(false);
	});

	it.each([
		{ name: "zero bytes", sizeBytes: 0 },
		{ name: "above maximum", sizeBytes: EVENT_IMAGE_MAX_SIZE_BYTES + 1 },
		{ name: "fractional bytes", sizeBytes: 1024.5 },
	])("rejects invalid size: $name", ({ sizeBytes }) => {
		const result = eventImageUploadUrlRequestSchema.safeParse({
			kind: "route_map",
			fileName: "route.webp",
			contentType: "image/webp",
			sizeBytes,
		});

		expect(result.success).toBe(false);
	});
});

describe("eventImageUploadUrlResponseSchema", () => {
	it("accepts presigned PUT upload responses", () => {
		const result = eventImageUploadUrlResponseSchema.parse({
			imageId,
			url: "https://storage.example.com/events/hero.jpg",
			method: "PUT",
			headers: { "content-type": "image/jpeg" },
			key: "events/event-1/hero.jpg",
			expiresAt: createdAt,
		});

		expect(result.method).toBe("PUT");
		expect(result.headers["content-type"]).toBe("image/jpeg");
	});

	it("rejects non-PUT upload methods", () => {
		const result = eventImageUploadUrlResponseSchema.safeParse({
			imageId,
			url: "https://storage.example.com/events/hero.jpg",
			method: "POST",
			headers: {},
			key: "events/event-1/hero.jpg",
			expiresAt: createdAt,
		});

		expect(result.success).toBe(false);
	});
});

describe("eventImageSchema", () => {
	it("accepts event image metadata", () => {
		const result = eventImageSchema.parse({
			id: imageId,
			eventId,
			kind: "hero",
			fileName: "hero.jpg",
			contentType: "image/jpeg",
			sizeBytes: 512_000,
			storageKey: "events/event-1/hero.jpg",
			status: "uploaded",
			uploadedBy,
			createdAt,
			updatedAt: createdAt,
		});

		expect(result.status).toBe("uploaded");
	});

	it("accepts nullable size for pending metadata", () => {
		const result = eventImageSchema.parse({
			id: imageId,
			eventId,
			kind: "route_map",
			fileName: "route.png",
			contentType: "image/png",
			sizeBytes: null,
			storageKey: "events/event-1/route.png",
			status: "pending",
			uploadedBy,
			createdAt,
			updatedAt: createdAt,
		});

		expect(result.sizeBytes).toBeNull();
	});

	it("wraps listed event images", () => {
		const result = eventImagesResponseSchema.parse({
			images: [
				{
					id: imageId,
					eventId,
					kind: "hero",
					fileName: "hero.webp",
					contentType: "image/webp",
					sizeBytes: 1024,
					storageKey: "events/event-1/hero.webp",
					status: "uploaded",
					uploadedBy,
					createdAt,
					updatedAt: createdAt,
				},
			],
		});

		expect(result.images).toHaveLength(1);
	});
});
