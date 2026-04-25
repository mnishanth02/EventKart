import { createHash, randomBytes } from "node:crypto";
import type { Database } from "@repo/db";
import { and, eq, isNull, sql } from "@repo/db";
import { emailVerifications, users } from "@repo/db/schema";
import {
	EMAIL_VERIFICATION_RATE_LIMIT_SECONDS,
	EMAIL_VERIFICATION_TOKEN_BYTES,
	EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
} from "@repo/shared/constants";
import type { Queue } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import {
	ConflictError,
	RateLimitError,
	ValidationError,
} from "../../lib/errors.js";

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** Check if a PostgreSQL error is a unique constraint violation. */
function isUniqueViolation(error: unknown, constraintName?: string): boolean {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return false;
	}
	const pgError = error as { code: string; constraint_name?: string };
	if (pgError.code !== "23505") return false;
	if (constraintName && pgError.constraint_name !== constraintName) {
		return false;
	}
	return true;
}

/**
 * Lua script for atomic Redis session role refresh.
 * Only updates if the key still exists (prevents session resurrection).
 *
 * KEYS[1] = sessionId
 * ARGV[1] = new role value
 *
 * Returns 1 if updated, 0 if key doesn't exist.
 */
const REFRESH_SESSION_ROLE_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return 0
end
local data = cjson.decode(raw)
data.role = ARGV[1]
local ttl = redis.call('TTL', KEYS[1])
if ttl > 0 then
  redis.call('SET', KEYS[1], cjson.encode(data), 'EX', ttl)
  return 1
end
return 0
`;

export interface SendVerificationDeps {
	db: Database;
	redis: Redis;
	emailQueue: Queue;
	config: { WEB_ORIGIN: string };
	log: FastifyBaseLogger;
}

export async function sendVerificationEmail(
	deps: SendVerificationDeps,
	userId: string,
	email: string,
): Promise<{ message: string; expiresInSeconds: number }> {
	// 1. Per-user rate limit via Redis
	const rateLimitKey = `email-verify-rl:${userId}`;
	const isLimited = await deps.redis.set(
		rateLimitKey,
		"1",
		"EX",
		EMAIL_VERIFICATION_RATE_LIMIT_SECONDS,
		"NX",
	);
	if (!isLimited) {
		throw new RateLimitError(
			"Please wait before requesting another verification email",
			{ retryAfterSeconds: EMAIL_VERIFICATION_RATE_LIMIT_SECONDS },
		);
	}

	// 2. Invalidate old pending tokens + insert new token in one transaction
	const rawToken = randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString("hex");
	const tokenHash = hashToken(rawToken);
	const expiresAt = new Date(
		Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_SECONDS * 1000,
	);

	await deps.db.transaction(async (tx) => {
		// Delete old pending tokens (they were never verified — no audit value)
		await tx
			.delete(emailVerifications)
			.where(
				and(
					eq(emailVerifications.userId, userId),
					isNull(emailVerifications.verifiedAt),
				),
			);

		// Insert new token
		await tx.insert(emailVerifications).values({
			userId,
			email,
			tokenHash,
			expiresAt,
		});
	});

	// 3. Enqueue email job
	const verificationUrl = `${deps.config.WEB_ORIGIN}/auth/verify-email?token=${rawToken}`;
	await deps.emailQueue.add("verification", {
		to: email,
		subject: "Verify your email — EventKart",
		html: `<p>Click the link below to verify your email and become an EventKart organizer:</p>
<p><a href="${verificationUrl}">${verificationUrl}</a></p>
<p>This link expires in 24 hours.</p>`,
	});

	return {
		message: "Verification email sent",
		expiresInSeconds: EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
	};
}

export interface VerifyTokenDeps {
	db: Database;
	sessionRedis: Redis;
	log: FastifyBaseLogger;
}

export async function verifyEmailToken(
	deps: VerifyTokenDeps,
	token: string,
	sessionInfo: { userId: string; sessionId: string },
): Promise<{ role: string; email: string }> {
	const tokenHash = hashToken(token);

	// All DB work in a single transaction — if user update fails,
	// the token consumption is rolled back automatically.
	let verifiedEmail: string;
	let finalRole: string;

	try {
		const result = await deps.db.transaction(async (tx) => {
			// Atomic: find + consume token
			const [verification] = await tx
				.update(emailVerifications)
				.set({ verifiedAt: sql`now()` })
				.where(
					and(
						eq(emailVerifications.tokenHash, tokenHash),
						eq(emailVerifications.userId, sessionInfo.userId),
						isNull(emailVerifications.verifiedAt),
						sql`${emailVerifications.expiresAt} > now()`,
					),
				)
				.returning({
					email: emailVerifications.email,
					userId: emailVerifications.userId,
				});

			if (!verification) {
				throw new ValidationError("Invalid or expired verification token");
			}

			// Elevate role to organizer (only if participant)
			const [updatedUser] = await tx
				.update(users)
				.set({
					email: verification.email,
					role: "organizer",
				})
				.where(
					and(eq(users.id, sessionInfo.userId), eq(users.role, "participant")),
				)
				.returning({ role: users.role });

			// If user was already organizer/admin, just update email
			if (!updatedUser) {
				await tx
					.update(users)
					.set({ email: verification.email })
					.where(eq(users.id, sessionInfo.userId));
			}

			// Read the actual current role from DB (prevents role downgrade bug)
			const [currentUser] = await tx
				.select({ role: users.role })
				.from(users)
				.where(eq(users.id, sessionInfo.userId));

			if (!currentUser) {
				throw new ValidationError("User not found");
			}

			return {
				email: verification.email,
				role: currentUser.role,
			};
		});

		verifiedEmail = result.email;
		finalRole = result.role;
	} catch (error) {
		// Catch email uniqueness violation and return clear 409
		if (isUniqueViolation(error, "users_email_unique")) {
			throw new ConflictError("Email address is already in use");
		}
		throw error;
	}

	// Refresh Redis session with actual role (AFTER transaction commit).
	// Uses Lua script to atomically check existence + update,
	// preventing resurrection of a deleted (logged-out) session.
	try {
		await deps.sessionRedis.eval(
			REFRESH_SESSION_ROLE_LUA,
			1,
			sessionInfo.sessionId,
			finalRole,
		);
	} catch (redisError) {
		// Redis failure is non-fatal — session will have stale role
		// until next login. Log and continue.
		deps.log.error(
			{ err: redisError, sessionId: sessionInfo.sessionId },
			"Failed to refresh session role in Redis after email verification",
		);
	}

	return { role: finalRole, email: verifiedEmail };
}
