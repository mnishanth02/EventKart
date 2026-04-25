import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import {
	acquireOtpSendLock,
	deleteOtp,
	generateOtp,
	getOtpCooldownTtl,
	getStoredOtp,
	hashOtp,
	incrementOtpAttempts,
	isMaxAttemptsExceeded,
	storeOtp,
	verifyAndConsumeOtp,
	verifyOtpHash,
} from "../../src/lib/otp.js";

const TEST_SECRET = "test-otp-secret";

function createMockRedis(overrides: Partial<Record<string, unknown>> = {}) {
	const mockPipelineSet = vi.fn();
	const mockPipelineExec = vi.fn().mockResolvedValue([]);

	return {
		redis: {
			set: vi.fn(),
			get: vi.fn(),
			del: vi.fn(),
			ttl: vi.fn(),
			eval: vi.fn(),
			pipeline: vi.fn().mockReturnValue({
				set: mockPipelineSet,
				exec: mockPipelineExec,
			}),
			...overrides,
		} as unknown as Redis,
		mockPipelineSet,
		mockPipelineExec,
	};
}

describe("OTP Library", () => {
	describe("generateOtp", () => {
		it("returns a 6-digit string by default", () => {
			const otp = generateOtp();
			expect(otp).toHaveLength(6);
		});

		it("returns correct length for custom length", () => {
			const otp4 = generateOtp(4);
			expect(otp4).toHaveLength(4);

			const otp8 = generateOtp(8);
			expect(otp8).toHaveLength(8);
		});

		it("produces different values across multiple calls", () => {
			const otps = new Set<string>();
			for (let i = 0; i < 20; i++) {
				otps.add(generateOtp());
			}
			expect(otps.size).toBeGreaterThan(1);
		});

		it("contains only numeric characters", () => {
			for (let i = 0; i < 10; i++) {
				const otp = generateOtp();
				expect(otp).toMatch(/^\d+$/);
			}
		});
	});

	describe("hashOtp", () => {
		it("returns a 64-character hex string", () => {
			const hash = hashOtp("123456", TEST_SECRET);
			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});

		it("is deterministic (same input produces same hash)", () => {
			const hash1 = hashOtp("999999", TEST_SECRET);
			const hash2 = hashOtp("999999", TEST_SECRET);
			expect(hash1).toBe(hash2);
		});

		it("produces different hashes for different inputs", () => {
			const hash1 = hashOtp("123456", TEST_SECRET);
			const hash2 = hashOtp("654321", TEST_SECRET);
			expect(hash1).not.toBe(hash2);
		});

		it("produces different hashes for different secrets", () => {
			const hash1 = hashOtp("123456", "secret-a");
			const hash2 = hashOtp("123456", "secret-b");
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("verifyOtpHash", () => {
		it("returns true for matching OTP and hash", () => {
			const otp = "123456";
			const hash = hashOtp(otp, TEST_SECRET);
			expect(verifyOtpHash(otp, hash, TEST_SECRET)).toBe(true);
		});

		it("returns false for non-matching OTP", () => {
			const hash = hashOtp("123456", TEST_SECRET);
			expect(verifyOtpHash("000000", hash, TEST_SECRET)).toBe(false);
		});

		it("returns false for wrong secret", () => {
			const hash = hashOtp("123456", TEST_SECRET);
			expect(verifyOtpHash("123456", hash, "wrong-secret")).toBe(false);
		});
	});

	describe("acquireOtpSendLock", () => {
		it("returns true when redis.set returns 'OK' (lock acquired)", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.set).mockResolvedValue("OK");

			const result = await acquireOtpSendLock(redis, "+919876543210");
			expect(result).toBe(true);
		});

		it("returns false when redis.set returns null (already locked)", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.set).mockResolvedValue(null as never);

			const result = await acquireOtpSendLock(redis, "+919876543210");
			expect(result).toBe(false);
		});

		it("calls redis.set with correct key pattern and args", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.set).mockResolvedValue("OK");

			await acquireOtpSendLock(redis, "+919876543210");

			expect(redis.set).toHaveBeenCalledWith(
				"cooldown:+919876543210",
				"1",
				"EX",
				60,
				"NX",
			);
		});
	});

	describe("getOtpCooldownTtl", () => {
		it("returns the TTL value when > 0", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.ttl).mockResolvedValue(45);

			const ttl = await getOtpCooldownTtl(redis, "+919876543210");
			expect(ttl).toBe(45);
		});

		it("returns 0 when TTL is -2 (key doesn't exist)", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.ttl).mockResolvedValue(-2);

			const ttl = await getOtpCooldownTtl(redis, "+919876543210");
			expect(ttl).toBe(0);
		});

		it("returns 0 when TTL is -1 (no expiry)", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.ttl).mockResolvedValue(-1);

			const ttl = await getOtpCooldownTtl(redis, "+919876543210");
			expect(ttl).toBe(0);
		});

		it("returns 0 when TTL is 0", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.ttl).mockResolvedValue(0);

			const ttl = await getOtpCooldownTtl(redis, "+919876543210");
			expect(ttl).toBe(0);
		});

		it("calls redis.ttl with correct cooldown key", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.ttl).mockResolvedValue(30);

			await getOtpCooldownTtl(redis, "+919876543210");
			expect(redis.ttl).toHaveBeenCalledWith("cooldown:+919876543210");
		});
	});

	describe("storeOtp", () => {
		it("calls pipeline.set with correct JSON data and TTL", async () => {
			const { redis, mockPipelineSet } = createMockRedis();
			const otp = "123456";
			const hash = hashOtp(otp, TEST_SECRET);

			await storeOtp(redis, "+919876543210", otp, "sms", TEST_SECRET);

			expect(mockPipelineSet).toHaveBeenCalledWith(
				"+919876543210",
				JSON.stringify({ hash, attempts: 0, channel: "sms" }),
				"EX",
				300,
			);
		});

		it("stores HMAC hash, not plaintext OTP", async () => {
			const { redis, mockPipelineSet } = createMockRedis();

			await storeOtp(redis, "+919876543210", "123456", "whatsapp", TEST_SECRET);

			const storedJson = mockPipelineSet.mock.calls[0]?.[1] as string;
			const stored = JSON.parse(storedJson);
			expect(stored.hash).not.toBe("123456");
			expect(stored.hash).toHaveLength(64);
		});

		it("preserves channel in stored data", async () => {
			const { redis, mockPipelineSet } = createMockRedis();

			await storeOtp(redis, "+919876543210", "123456", "log", TEST_SECRET);

			const storedJson = mockPipelineSet.mock.calls[0]?.[1] as string;
			const stored = JSON.parse(storedJson);
			expect(stored.channel).toBe("log");
		});

		it("executes the pipeline", async () => {
			const { redis, mockPipelineExec } = createMockRedis();

			await storeOtp(redis, "+919876543210", "123456", "sms", TEST_SECRET);

			expect(mockPipelineExec).toHaveBeenCalledOnce();
		});
	});

	describe("getStoredOtp", () => {
		it("returns parsed StoredOtp when key exists", async () => {
			const { redis } = createMockRedis();
			const data = { hash: "abc123", attempts: 2, channel: "sms" };
			vi.mocked(redis.get).mockResolvedValue(JSON.stringify(data));

			const result = await getStoredOtp(redis, "+919876543210");

			expect(result).toEqual(data);
		});

		it("returns null when key doesn't exist", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.get).mockResolvedValue(null);

			const result = await getStoredOtp(redis, "+919876543210");
			expect(result).toBeNull();
		});
	});

	describe("incrementOtpAttempts", () => {
		it("returns incremented count when OTP exists", async () => {
			const { redis } = createMockRedis();
			const data = { hash: "abc123", attempts: 2, channel: "sms" };
			vi.mocked(redis.get).mockResolvedValue(JSON.stringify(data));
			vi.mocked(redis.ttl).mockResolvedValue(120);
			vi.mocked(redis.set).mockResolvedValue("OK");

			const result = await incrementOtpAttempts(redis, "+919876543210");

			expect(result).toBe(3);
		});

		it("stores the updated attempts back to Redis with remaining TTL", async () => {
			const { redis } = createMockRedis();
			const data = { hash: "abc123", attempts: 1, channel: "whatsapp" };
			vi.mocked(redis.get).mockResolvedValue(JSON.stringify(data));
			vi.mocked(redis.ttl).mockResolvedValue(200);
			vi.mocked(redis.set).mockResolvedValue("OK");

			await incrementOtpAttempts(redis, "+919876543210");

			expect(redis.set).toHaveBeenCalledWith(
				"+919876543210",
				JSON.stringify({ hash: "abc123", attempts: 2, channel: "whatsapp" }),
				"EX",
				200,
			);
		});

		it("returns null when OTP doesn't exist", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.get).mockResolvedValue(null);

			const result = await incrementOtpAttempts(redis, "+919876543210");
			expect(result).toBeNull();
		});

		it("returns null when TTL is expired (≤ 0)", async () => {
			const { redis } = createMockRedis();
			const data = { hash: "abc123", attempts: 0, channel: "sms" };
			vi.mocked(redis.get).mockResolvedValue(JSON.stringify(data));
			vi.mocked(redis.ttl).mockResolvedValue(0);

			const result = await incrementOtpAttempts(redis, "+919876543210");
			expect(result).toBeNull();
		});

		it("returns null when TTL is negative", async () => {
			const { redis } = createMockRedis();
			const data = { hash: "abc123", attempts: 0, channel: "sms" };
			vi.mocked(redis.get).mockResolvedValue(JSON.stringify(data));
			vi.mocked(redis.ttl).mockResolvedValue(-1);

			const result = await incrementOtpAttempts(redis, "+919876543210");
			expect(result).toBeNull();
		});
	});

	describe("isMaxAttemptsExceeded", () => {
		it("returns false for attempts < 5", () => {
			expect(isMaxAttemptsExceeded(0)).toBe(false);
			expect(isMaxAttemptsExceeded(1)).toBe(false);
			expect(isMaxAttemptsExceeded(4)).toBe(false);
		});

		it("returns true for attempts equal to 5", () => {
			expect(isMaxAttemptsExceeded(5)).toBe(true);
		});

		it("returns true for attempts greater than 5", () => {
			expect(isMaxAttemptsExceeded(6)).toBe(true);
			expect(isMaxAttemptsExceeded(100)).toBe(true);
		});
	});

	describe("deleteOtp", () => {
		it("calls redis.del with the phone number", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.del).mockResolvedValue(1);

			await deleteOtp(redis, "+919876543210");

			expect(redis.del).toHaveBeenCalledWith("+919876543210");
		});
	});

	describe("verifyAndConsumeOtp", () => {
		it("returns success when OTP matches", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.eval).mockResolvedValue(
				JSON.stringify({ status: "success", channel: "sms" }),
			);

			const result = await verifyAndConsumeOtp(
				redis,
				"+919876543210",
				"123456",
				TEST_SECRET,
			);

			expect(result).toEqual({ status: "success", channel: "sms" });
		});

		it("returns expired when no OTP found", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.eval).mockResolvedValue(
				JSON.stringify({ status: "expired" }),
			);

			const result = await verifyAndConsumeOtp(
				redis,
				"+919876543210",
				"123456",
				TEST_SECRET,
			);

			expect(result).toEqual({ status: "expired" });
		});

		it("returns invalid with attemptsRemaining on mismatch", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.eval).mockResolvedValue(
				JSON.stringify({ status: "invalid", attemptsRemaining: 3 }),
			);

			const result = await verifyAndConsumeOtp(
				redis,
				"+919876543210",
				"000000",
				TEST_SECRET,
			);

			expect(result).toEqual({ status: "invalid", attemptsRemaining: 3 });
		});

		it("returns max_attempts when limit exceeded", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.eval).mockResolvedValue(
				JSON.stringify({ status: "max_attempts" }),
			);

			const result = await verifyAndConsumeOtp(
				redis,
				"+919876543210",
				"000000",
				TEST_SECRET,
			);

			expect(result).toEqual({ status: "max_attempts" });
		});

		it("passes computed hash and max attempts to Lua script", async () => {
			const { redis } = createMockRedis();
			vi.mocked(redis.eval).mockResolvedValue(
				JSON.stringify({ status: "success", channel: "log" }),
			);

			await verifyAndConsumeOtp(redis, "+919876543210", "123456", TEST_SECRET);

			const expectedHash = hashOtp("123456", TEST_SECRET);
			expect(redis.eval).toHaveBeenCalledWith(
				expect.any(String),
				1,
				"+919876543210",
				expectedHash,
				"5",
			);
		});
	});
});
