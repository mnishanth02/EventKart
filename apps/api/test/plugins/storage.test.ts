import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Mock AWS SDK
const mockDestroy = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
	class MockS3Client {
		destroy = mockDestroy;
	}
	return {
		S3Client: MockS3Client,
		PutObjectCommand: class {},
		GetObjectCommand: class {},
		DeleteObjectCommand: class {},
		HeadObjectCommand: class {},
	};
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: vi.fn().mockResolvedValue("https://presigned.example.com"),
}));

import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

// Also mock ioredis for the redis plugin
const mockPing = vi.fn().mockResolvedValue("PONG");
const mockQuit = vi.fn().mockResolvedValue("OK");

vi.mock("ioredis", () => {
	class MockRedis {
		ping = mockPing;
		quit = mockQuit;
		options: Record<string, unknown>;
		constructor(_url: string, options?: Record<string, unknown>) {
			this.options = options ?? {};
			const self = this as Record<string, unknown>;
			self.defineCommand = vi.fn().mockImplementation((name: string) => {
				self[name] = vi.fn().mockImplementation((...args: unknown[]) => {
					const cb = args[args.length - 1];
					if (typeof cb === "function") {
						(cb as (err: null, r: number[]) => void)(null, [0, 0]);
						return;
					}
					return Promise.resolve([0, 0]);
				});
			});
		}
	}
	return { Redis: MockRedis, default: MockRedis };
});

describe("Storage Plugin", () => {
	describe("when S3 is not configured", () => {
		let app: FastifyInstance;

		beforeAll(async () => {
			app = buildApp({
				logger: false,
				config: {
					HOST: "127.0.0.1",
					PORT: 3001,
					LOG_LEVEL: "info",
					WEB_ORIGIN: "http://localhost:3000",
					DATABASE_URL:
						"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
					REDIS_URL: "redis://localhost:6379",
				},
			});
			await app.ready();
		});

		afterAll(async () => {
			await app?.close();
		});

		it("decorates fastify with a disabled storage client", () => {
			expect(app.storage).toBeDefined();
			expect(app.storage.enabled).toBe(false);
		});

		it("disabled client throws on getUploadUrl", async () => {
			await expect(
				app.storage.getUploadUrl({
					category: "kyc",
					ownerId: "user-1",
					extension: "pdf",
					contentType: "application/pdf",
					maxBytes: 10 * 1024 * 1024,
				}),
			).rejects.toThrow("Object storage is not configured");
		});
	});

	describe("when S3 is configured", () => {
		let app: FastifyInstance;

		beforeAll(async () => {
			app = buildApp({
				logger: false,
				config: {
					HOST: "127.0.0.1",
					PORT: 3001,
					LOG_LEVEL: "info",
					WEB_ORIGIN: "http://localhost:3000",
					DATABASE_URL:
						"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev",
					REDIS_URL: "redis://localhost:6379",
					S3_ENDPOINT: "https://test.r2.cloudflarestorage.com",
					S3_REGION: "auto",
					S3_ACCESS_KEY_ID: "test-key",
					S3_SECRET_ACCESS_KEY: "test-secret",
					S3_BUCKET: "test-bucket",
					S3_FORCE_PATH_STYLE: true,
				},
			});
			await app.ready();
		});

		afterAll(async () => {
			await app?.close();
		});

		it("decorates fastify with an enabled storage client", () => {
			expect(app.storage).toBeDefined();
			expect(app.storage.enabled).toBe(true);
		});
	});
});
