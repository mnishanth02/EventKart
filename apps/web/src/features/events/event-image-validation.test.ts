import { EVENT_IMAGE_MAX_SIZE_BYTES } from "@repo/shared/constants";
import { describe, expect, it } from "vitest";
import {
	formatEventImageFileSize,
	validateEventImageFile,
} from "./event-image-validation";

describe("validateEventImageFile", () => {
	it("accepts supported event image files within the size limit", () => {
		const file = new File(["image"], "hero.webp", { type: "image/webp" });

		expect(validateEventImageFile(file)).toEqual({
			valid: true,
			contentType: "image/webp",
		});
	});

	it("rejects unsupported image MIME types", () => {
		const file = new File(["image"], "hero.gif", { type: "image/gif" });

		expect(validateEventImageFile(file)).toEqual({
			valid: false,
			message: "Only JPEG, PNG, and WebP images are accepted.",
		});
	});

	it("rejects files larger than 5 MB", () => {
		const file = new File(
			[new Uint8Array(EVENT_IMAGE_MAX_SIZE_BYTES + 1)],
			"hero.png",
			{
				type: "image/png",
			},
		);

		expect(validateEventImageFile(file)).toEqual({
			valid: false,
			message: "Image size must not exceed 5.0 MB.",
		});
	});
});

describe("formatEventImageFileSize", () => {
	it("formats null and byte sizes for display", () => {
		expect(formatEventImageFileSize(null)).toBe("Unknown size");
		expect(formatEventImageFileSize(512)).toBe("512 B");
		expect(formatEventImageFileSize(1536)).toBe("1.5 KB");
		expect(formatEventImageFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
	});
});
