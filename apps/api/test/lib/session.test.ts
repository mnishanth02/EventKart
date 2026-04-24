import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Redis } from "ioredis";
import {
	generateSessionId,
	createRedisSession,
	getRedisSession,
	deleteRedisSession,
	buildSessionCookieOptions,
	type SessionData,
} from "../../src/lib/session.js";

function createMockRedis() {
	return {
		set: vi.fn().mockResolvedValue("OK"),
		get: vi.fn().mockResolvedValue(null),
		del: vi.fn().mockResolvedValue(1),
	} as unknown as Redis;
}

describe("Session Management", () => {
	describe("generateSessionId", () => {
		it("returns a valid UUID v4 string", () => {
			const sessionId = generateSessionId();
			const uuidV4Regex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			expect(uuidV4Regex.test(sessionId)).toBe(true);
		});

		it("returns unique values across calls", () => {
			const id1 = generateSessionId();
			const id2 = generateSessionId();
			const id3 = generateSessionId();

			expect(id1).not.toBe(id2);
			expect(id2).not.toBe(id3);
			expect(id1).not.toBe(id3);
		});
	});

	describe("createRedisSession", () => {
		it("calls redis.set with sessionId, JSON data, EX, and TTL (30 * 24 * 60 * 60 = 2592000)", async () => {
			const mockRedis = createMockRedis();
			const sessionId = "test-session-id";
			const data: SessionData = {
				userId: "user-123",
				role: "admin",
				expiresAt: "2025-12-31T23:59:59Z",
			};

			await createRedisSession(mockRedis, sessionId, data);

			expect(mockRedis.set).toHaveBeenCalledOnce();
			expect(mockRedis.set).toHaveBeenCalledWith(
				sessionId,
				JSON.stringify(data),
				"EX",
				2592000,
			);
		});

		it("stored JSON contains userId, role, expiresAt", async () => {
			const mockRedis = createMockRedis();
			const sessionId = "test-session-id";
			const data: SessionData = {
				userId: "user-456",
				role: "user",
				expiresAt: "2025-06-15T12:00:00Z",
			};

			await createRedisSession(mockRedis, sessionId, data);

			const callArgs = vi.mocked(mockRedis.set).mock.calls[0];
			const storedJson = callArgs?.[1] as string;
			const parsed = JSON.parse(storedJson) as SessionData;

			expect(parsed.userId).toBe("user-456");
			expect(parsed.role).toBe("user");
			expect(parsed.expiresAt).toBe("2025-06-15T12:00:00Z");
		});
	});

	describe("getRedisSession", () => {
		it("returns parsed SessionData when key exists", async () => {
			const mockRedis = createMockRedis();
			const sessionId = "test-session-id";
			const data: SessionData = {
				userId: "user-789",
				role: "moderator",
				expiresAt: "2025-09-20T10:30:00Z",
			};

			(mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				JSON.stringify(data),
			);

			const result = await getRedisSession(mockRedis, sessionId);

			expect(mockRedis.get).toHaveBeenCalledWith(sessionId);
			expect(result).toEqual(data);
		});

		it("returns null when key doesn't exist", async () => {
			const mockRedis = createMockRedis();
			const sessionId = "nonexistent-session";

			(mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

			const result = await getRedisSession(mockRedis, sessionId);

			expect(mockRedis.get).toHaveBeenCalledWith(sessionId);
			expect(result).toBeNull();
		});
	});

	describe("deleteRedisSession", () => {
		it("calls redis.del with the session ID", async () => {
			const mockRedis = createMockRedis();
			const sessionId = "test-session-id-to-delete";

			await deleteRedisSession(mockRedis, sessionId);

			expect(mockRedis.del).toHaveBeenCalledOnce();
			expect(mockRedis.del).toHaveBeenCalledWith(sessionId);
		});
	});

	describe("buildSessionCookieOptions", () => {
		const originalEnv = process.env.NODE_ENV;

		afterEach(() => {
			process.env.NODE_ENV = originalEnv;
		});

		it("returns httpOnly: true, sameSite: lax, path: /", () => {
			const options = buildSessionCookieOptions();

			expect(options.httpOnly).toBe(true);
			expect(options.sameSite).toBe("lax");
			expect(options.path).toBe("/");
		});

		it("returns maxAge = 2592000 (30 days in seconds)", () => {
			const options = buildSessionCookieOptions();

			expect(options.maxAge).toBe(2592000);
		});

		it("does NOT include domain when no cookieDomain provided", () => {
			const options = buildSessionCookieOptions();

			expect(options.domain).toBeUndefined();
		});

		it("includes domain when cookieDomain provided", () => {
			const options = buildSessionCookieOptions("example.com");

			expect(options.domain).toBe("example.com");
		});

		it("secure is true when NODE_ENV is production", () => {
			process.env.NODE_ENV = "production";

			const options = buildSessionCookieOptions();

			expect(options.secure).toBe(true);
		});

		it("secure is false when NODE_ENV is not production", () => {
			process.env.NODE_ENV = "development";

			const options = buildSessionCookieOptions();

			expect(options.secure).toBe(false);
		});

		it("secure is false when NODE_ENV is test", () => {
			process.env.NODE_ENV = "test";

			const options = buildSessionCookieOptions();

			expect(options.secure).toBe(false);
		});
	});
});
