import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
	OTP_LENGTH,
	OTP_MAX_ATTEMPTS,
	OTP_RATE_LIMIT_WINDOW_SECONDS,
	OTP_TTL_SECONDS,
} from "@repo/shared/constants";
import type { Redis } from "ioredis";

export interface StoredOtp {
	hash: string;
	attempts: number;
	channel: "sms" | "whatsapp" | "log";
}

/**
 * Result of an atomic OTP verification attempt.
 * - "success": OTP matched and was consumed (deleted).
 * - "expired": No OTP found for the phone (expired or never sent).
 * - "invalid": OTP did not match; attemptsRemaining indicates how many tries left.
 * - "max_attempts": Too many failed attempts; OTP was deleted.
 */
export type VerifyOtpResult =
	| { status: "success"; channel: StoredOtp["channel"] }
	| { status: "expired" }
	| { status: "invalid"; attemptsRemaining: number }
	| { status: "max_attempts" };

/** Generate a cryptographically secure numeric OTP. */
export function generateOtp(length: number = OTP_LENGTH): string {
	const min = 10 ** (length - 1);
	const max = 10 ** length;
	return String(randomInt(min, max));
}

/** Hash an OTP using HMAC-SHA256 with the provided secret. */
export function hashOtp(otp: string, secret: string): string {
	return createHmac("sha256", secret).update(otp).digest("hex");
}

/** Timing-safe verification of an OTP against its stored hash. */
export function verifyOtpHash(
	otp: string,
	storedHash: string,
	secret: string,
): boolean {
	const computed = hashOtp(otp, secret);
	const a = Buffer.from(computed, "hex");
	const b = Buffer.from(storedHash, "hex");
	if (a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(a, b);
}

/**
 * Atomically check rate limit and acquire a send lock.
 * Uses SET NX EX to prevent race conditions between concurrent requests.
 *
 * @returns `true` if the send is allowed (lock acquired), `false` if rate-limited.
 */
export async function acquireOtpSendLock(
	redis: Redis,
	phone: string,
): Promise<boolean> {
	const key = `cooldown:${phone}`;
	const result = await redis.set(
		key,
		"1",
		"EX",
		OTP_RATE_LIMIT_WINDOW_SECONDS,
		"NX",
	);
	return result === "OK";
}

/**
 * Release the OTP send cooldown lock (e.g. on delivery failure).
 */
export async function releaseOtpSendLock(
	redis: Redis,
	phone: string,
): Promise<void> {
	await redis.del(`cooldown:${phone}`);
}

/**
 * Shorten cooldown to a brief retry window after a delivery failure.
 * Uses EXPIRE to reduce TTL instead of DEL to avoid racing with concurrent requests.
 */
export async function shortenOtpCooldown(
	redis: Redis,
	phone: string,
	seconds: number,
): Promise<void> {
	await redis.expire(`cooldown:${phone}`, seconds);
}

/**
 * Get remaining cooldown time for a phone number.
 * @returns Seconds remaining, or 0 if no cooldown.
 */
export async function getOtpCooldownTtl(
	redis: Redis,
	phone: string,
): Promise<number> {
	const ttl = await redis.ttl(`cooldown:${phone}`);
	return ttl > 0 ? ttl : 0;
}

/**
 * Store a hashed OTP in Redis with TTL.
 * Uses a Redis hash to store the OTP hash, attempt counter, and delivery channel.
 */
export async function storeOtp(
	redis: Redis,
	phone: string,
	otp: string,
	channel: StoredOtp["channel"],
	secret: string,
): Promise<void> {
	const data: StoredOtp = {
		hash: hashOtp(otp, secret),
		attempts: 0,
		channel,
	};

	const pipeline = redis.pipeline();
	pipeline.set(phone, JSON.stringify(data), "EX", OTP_TTL_SECONDS);
	await pipeline.exec();
}

/**
 * Retrieve the stored OTP data for a phone number.
 * @returns The stored OTP data, or null if expired/not found.
 */
export async function getStoredOtp(
	redis: Redis,
	phone: string,
): Promise<StoredOtp | null> {
	const raw = await redis.get(phone);

	if (!raw) {
		return null;
	}

	return JSON.parse(raw) as StoredOtp;
}

/**
 * Increment the attempt counter for a stored OTP.
 * @returns The new attempt count, or null if OTP not found.
 */
export async function incrementOtpAttempts(
	redis: Redis,
	phone: string,
): Promise<number | null> {
	const stored = await getStoredOtp(redis, phone);

	if (!stored) {
		return null;
	}

	stored.attempts += 1;

	const ttl = await redis.ttl(phone);

	if (ttl <= 0) {
		return null;
	}

	await redis.set(phone, JSON.stringify(stored), "EX", ttl);
	return stored.attempts;
}

/** Check if the OTP has exceeded max verification attempts. */
export function isMaxAttemptsExceeded(attempts: number): boolean {
	return attempts >= OTP_MAX_ATTEMPTS;
}

/** Delete stored OTP (after successful verification or manual invalidation). */
export async function deleteOtp(redis: Redis, phone: string): Promise<void> {
	await redis.del(phone);
}

/**
 * Lua script for atomic OTP verification.
 *
 * KEYS[1] = phone key (otp:<phone> via prefix)
 * ARGV[1] = computed OTP hash to compare
 * ARGV[2] = max attempts allowed
 *
 * Returns a JSON string:
 * - `{"status":"expired"}` if key not found
 * - `{"status":"success","channel":"sms"}` on match (key deleted)
 * - `{"status":"max_attempts"}` if attempts exceeded (key deleted)
 * - `{"status":"invalid","attemptsRemaining":N}` on mismatch
 */
const VERIFY_OTP_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return '{"status":"expired"}'
end

local data = cjson.decode(raw)
local storedHash = data.hash
local attempts = tonumber(data.attempts)
local channel = data.channel
local maxAttempts = tonumber(ARGV[2])

if ARGV[1] == storedHash then
  redis.call('DEL', KEYS[1])
  return cjson.encode({status = "success", channel = channel})
end

attempts = attempts + 1

if attempts >= maxAttempts then
  redis.call('DEL', KEYS[1])
  return '{"status":"max_attempts"}'
end

data.attempts = attempts
local ttl = redis.call('TTL', KEYS[1])
if ttl > 0 then
  redis.call('SET', KEYS[1], cjson.encode(data), 'EX', ttl)
end

return cjson.encode({status = "invalid", attemptsRemaining = maxAttempts - attempts})
`;

/**
 * Atomically verify and consume an OTP using a Redis Lua script.
 *
 * This prevents race conditions where concurrent requests could both
 * successfully verify the same OTP, or where attempt counts are lost.
 */
export async function verifyAndConsumeOtp(
	redis: Redis,
	phone: string,
	otp: string,
	secret: string,
): Promise<VerifyOtpResult> {
	const computedHash = hashOtp(otp, secret);

	const result = await redis.eval(
		VERIFY_OTP_LUA,
		1,
		phone,
		computedHash,
		String(OTP_MAX_ATTEMPTS),
	);

	return JSON.parse(result as string) as VerifyOtpResult;
}
