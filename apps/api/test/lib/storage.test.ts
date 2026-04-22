import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AWS SDK before importing storage module
const mockSend = vi.fn();
const mockDestroy = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
	class MockS3Client {
		send = mockSend;
		destroy = mockDestroy;
		config: Record<string, unknown>;

		constructor(config: Record<string, unknown>) {
			this.config = config;
		}
	}

	return {
		S3Client: MockS3Client,
		PutObjectCommand: class PutObjectCommand {
			input: Record<string, unknown>;
			constructor(input: Record<string, unknown>) {
				this.input = input;
			}
		},
		GetObjectCommand: class GetObjectCommand {
			input: Record<string, unknown>;
			constructor(input: Record<string, unknown>) {
				this.input = input;
			}
		},
		DeleteObjectCommand: class DeleteObjectCommand {
			input: Record<string, unknown>;
			constructor(input: Record<string, unknown>) {
				this.input = input;
			}
		},
		HeadObjectCommand: class HeadObjectCommand {
			input: Record<string, unknown>;
			constructor(input: Record<string, unknown>) {
				this.input = input;
			}
		},
	};
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

import {
	ALLOWED_CONTENT_TYPES,
	MAX_FILE_SIZES,
	STORAGE_PREFIXES,
	StorageUnavailableError,
	createDisabledStorageClient,
	createStorageClient,
	generateStorageKey,
} from "../../src/lib/storage.js";
import type { StorageClientConfig } from "../../src/lib/storage.js";

const TEST_CONFIG: StorageClientConfig = {
	endpoint: "https://test.r2.cloudflarestorage.com",
	region: "auto",
	accessKeyId: "test-key",
	secretAccessKey: "test-secret",
	bucket: "test-bucket",
	forcePathStyle: true,
};

describe("Storage constants", () => {
	it("exports storage prefixes for all categories", () => {
		expect(STORAGE_PREFIXES).toHaveProperty("kyc");
		expect(STORAGE_PREFIXES).toHaveProperty("event-image");
		expect(STORAGE_PREFIXES).toHaveProperty("roster-export");
	});

	it("exports allowed content types for all categories", () => {
		expect(ALLOWED_CONTENT_TYPES.kyc).toContain("application/pdf");
		expect(ALLOWED_CONTENT_TYPES["event-image"]).toContain("image/jpeg");
		expect(ALLOWED_CONTENT_TYPES["roster-export"]).toContain("text/csv");
	});

	it("exports max file sizes for all categories", () => {
		expect(MAX_FILE_SIZES.kyc).toBe(10 * 1024 * 1024);
		expect(MAX_FILE_SIZES["event-image"]).toBe(5 * 1024 * 1024);
		expect(MAX_FILE_SIZES["roster-export"]).toBe(50 * 1024 * 1024);
	});
});

describe("generateStorageKey", () => {
	it("generates key with correct prefix for kyc", () => {
		const key = generateStorageKey("kyc", "user-123", "pdf");
		expect(key).toMatch(/^kyc\/user-123\/[a-f0-9-]+\.pdf$/);
	});

	it("generates key with correct prefix for event-image", () => {
		const key = generateStorageKey("event-image", "event-456", "jpg");
		expect(key).toMatch(/^events\/images\/event-456\/[a-f0-9-]+\.jpg$/);
	});

	it("generates key with correct prefix for roster-export", () => {
		const key = generateStorageKey("roster-export", "event-789", "csv");
		expect(key).toMatch(/^exports\/roster\/event-789\/[a-f0-9-]+\.csv$/);
	});

	it("strips leading dot from extension", () => {
		const key = generateStorageKey("kyc", "user-1", ".pdf");
		expect(key).toMatch(/\.pdf$/);
		expect(key).not.toMatch(/\.\.pdf$/);
	});

	it("sanitizes non-alphanumeric chars from extension", () => {
		const key = generateStorageKey("kyc", "user-1", "p.d.f");
		expect(key).toMatch(/\.pdf$/);
	});

	it("generates unique keys for same params", () => {
		const key1 = generateStorageKey("kyc", "user-1", "pdf");
		const key2 = generateStorageKey("kyc", "user-1", "pdf");
		expect(key1).not.toBe(key2);
	});
});

describe("createDisabledStorageClient", () => {
	it("returns a client with enabled = false", () => {
		const client = createDisabledStorageClient();
		expect(client.enabled).toBe(false);
	});

	it("throws StorageUnavailableError on getUploadUrl", async () => {
		const client = createDisabledStorageClient();
		await expect(
			client.getUploadUrl({
				category: "kyc",
				ownerId: "user-1",
				extension: "pdf",
				contentType: "application/pdf",
			}),
		).rejects.toThrow(StorageUnavailableError);
	});

	it("throws StorageUnavailableError on getDownloadUrl", async () => {
		const client = createDisabledStorageClient();
		await expect(
			client.getDownloadUrl({ key: "kyc/user-1/test.pdf" }),
		).rejects.toThrow(StorageUnavailableError);
	});

	it("throws StorageUnavailableError on deleteObject", async () => {
		const client = createDisabledStorageClient();
		await expect(client.deleteObject("test-key")).rejects.toThrow(
			StorageUnavailableError,
		);
	});

	it("throws StorageUnavailableError on headObject", async () => {
		const client = createDisabledStorageClient();
		await expect(client.headObject("test-key")).rejects.toThrow(
			StorageUnavailableError,
		);
	});

	it("destroy does not throw", () => {
		const client = createDisabledStorageClient();
		expect(() => client.destroy()).not.toThrow();
	});
});

describe("createStorageClient", () => {
	let client: ReturnType<typeof createStorageClient>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetSignedUrl.mockResolvedValue(
			"https://presigned-url.example.com/test",
		);
		client = createStorageClient(TEST_CONFIG);
	});

	it("returns a client with enabled = true", () => {
		expect(client.enabled).toBe(true);
	});

	describe("getUploadUrl", () => {
		it("returns presigned upload result with url, method, headers, key, expiresAt", async () => {
			const result = await client.getUploadUrl({
				category: "kyc",
				ownerId: "user-1",
				extension: "pdf",
				contentType: "application/pdf",
			});

			expect(result.url).toBe(
				"https://presigned-url.example.com/test",
			);
			expect(result.method).toBe("PUT");
			expect(result.headers["Content-Type"]).toBe("application/pdf");
			expect(result.key).toMatch(/^kyc\/user-1\//);
			expect(result.expiresAt).toBeInstanceOf(Date);
			expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
		});

		it("includes SSE header for KYC category", async () => {
			const result = await client.getUploadUrl({
				category: "kyc",
				ownerId: "user-1",
				extension: "pdf",
				contentType: "application/pdf",
			});

			expect(result.headers["x-amz-server-side-encryption"]).toBe(
				"AES256",
			);
		});

		it("does not include SSE header for event-image category", async () => {
			const result = await client.getUploadUrl({
				category: "event-image",
				ownerId: "event-1",
				extension: "jpg",
				contentType: "image/jpeg",
			});

			expect(result.headers).not.toHaveProperty(
				"x-amz-server-side-encryption",
			);
		});

		it("uses custom expiresIn when provided", async () => {
			const before = Date.now();
			const result = await client.getUploadUrl({
				category: "kyc",
				ownerId: "user-1",
				extension: "pdf",
				contentType: "application/pdf",
				expiresIn: 300,
			});

			const expectedExpiry = before + 300 * 1000;
			expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
				expectedExpiry - 1000,
			);
			expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
				expectedExpiry + 1000,
			);
		});

		it("calls getSignedUrl with PutObjectCommand", async () => {
			await client.getUploadUrl({
				category: "kyc",
				ownerId: "user-1",
				extension: "pdf",
				contentType: "application/pdf",
			});

			expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
			const [, command, options] = mockGetSignedUrl.mock.calls[0]!;
			expect(command.input.Bucket).toBe("test-bucket");
			expect(command.input.ContentType).toBe("application/pdf");
			expect(command.input.ServerSideEncryption).toBe("AES256");
			expect(options.expiresIn).toBe(900); // default
		});
	});

	describe("getDownloadUrl", () => {
		it("returns presigned download result", async () => {
			const result = await client.getDownloadUrl({
				key: "kyc/user-1/abc.pdf",
			});

			expect(result.url).toBe(
				"https://presigned-url.example.com/test",
			);
			expect(result.method).toBe("GET");
			expect(result.key).toBe("kyc/user-1/abc.pdf");
			expect(result.expiresAt).toBeInstanceOf(Date);
		});

		it("passes responseContentDisposition when provided", async () => {
			await client.getDownloadUrl({
				key: "kyc/user-1/abc.pdf",
				responseContentDisposition: 'attachment; filename="doc.pdf"',
			});

			expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
			const [, command] = mockGetSignedUrl.mock.calls[0]!;
			expect(command.input.ResponseContentDisposition).toBe(
				'attachment; filename="doc.pdf"',
			);
		});
	});

	describe("deleteObject", () => {
		it("sends DeleteObjectCommand", async () => {
			mockSend.mockResolvedValue({});
			await client.deleteObject("kyc/user-1/abc.pdf");

			expect(mockSend).toHaveBeenCalledTimes(1);
			const command = mockSend.mock.calls[0]![0];
			expect(command.input.Bucket).toBe("test-bucket");
			expect(command.input.Key).toBe("kyc/user-1/abc.pdf");
		});
	});

	describe("headObject", () => {
		it("returns metadata when object exists", async () => {
			const lastMod = new Date();
			mockSend.mockResolvedValue({
				ContentType: "application/pdf",
				ContentLength: 12345,
				LastModified: lastMod,
			});

			const result = await client.headObject("kyc/user-1/abc.pdf");
			expect(result).toEqual({
				contentType: "application/pdf",
				contentLength: 12345,
				lastModified: lastMod,
			});
		});

		it("returns null when object does not exist (404)", async () => {
			const error = new Error("NotFound");
			Object.assign(error, { $metadata: { httpStatusCode: 404 } });
			mockSend.mockRejectedValue(error);

			const result = await client.headObject(
				"kyc/user-1/nonexistent.pdf",
			);
			expect(result).toBeNull();
		});

		it("returns null when error name is NotFound", async () => {
			const error = new Error("not found");
			(error as Error & { name: string }).name = "NotFound";
			mockSend.mockRejectedValue(error);

			const result = await client.headObject("test-key");
			expect(result).toBeNull();
		});

		it("returns null when error name is NoSuchKey", async () => {
			const error = new Error("no such key");
			(error as Error & { name: string }).name = "NoSuchKey";
			mockSend.mockRejectedValue(error);

			const result = await client.headObject("test-key");
			expect(result).toBeNull();
		});

		it("rethrows other errors", async () => {
			mockSend.mockRejectedValue(new Error("network error"));

			await expect(client.headObject("test-key")).rejects.toThrow(
				"network error",
			);
		});
	});

	describe("destroy", () => {
		it("calls s3.destroy", () => {
			client.destroy();
			expect(mockDestroy).toHaveBeenCalledTimes(1);
		});
	});
});
