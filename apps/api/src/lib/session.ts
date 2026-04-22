import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionData {
	userId: string;
	role: string;
	expiresAt: string; // ISO 8601
}

/** Generate a cryptographically secure session ID. */
export function generateSessionId(): string {
	return randomUUID();
}

/**
 * Store session data in Redis.
 * Key: just the sessionId (the Redis client already has `sess:` prefix).
 */
export async function createRedisSession(
	redis: Redis,
	sessionId: string,
	data: SessionData,
): Promise<void> {
	await redis.set(sessionId, JSON.stringify(data), "EX", SESSION_TTL_SECONDS);
}

/**
 * Retrieve session data from Redis.
 * @returns Session data or null if not found/expired.
 */
export async function getRedisSession(
	redis: Redis,
	sessionId: string,
): Promise<SessionData | null> {
	const raw = await redis.get(sessionId);
	if (!raw) {
		return null;
	}
	return JSON.parse(raw) as SessionData;
}

/**
 * Delete a session from Redis (logout / revocation).
 */
export async function deleteRedisSession(
	redis: Redis,
	sessionId: string,
): Promise<void> {
	await redis.del(sessionId);
}

/**
 * Build session cookie options for @fastify/cookie.
 */
export function buildSessionCookieOptions(cookieDomain?: string): {
	path: string;
	httpOnly: boolean;
	secure: boolean;
	sameSite: "lax";
	maxAge: number;
	domain?: string;
} {
	const options: {
		path: string;
		httpOnly: boolean;
		secure: boolean;
		sameSite: "lax";
		maxAge: number;
		domain?: string;
	} = {
		path: "/",
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const,
		maxAge: SESSION_TTL_SECONDS,
	};

	if (cookieDomain) {
		options.domain = cookieDomain;
	}

	return options;
}
