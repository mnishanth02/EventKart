import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { Queue } from "bullmq";
import type { Database } from "@repo/db";
import { emailVerifications, users } from "@repo/db/schema";
import {
	EMAIL_VERIFICATION_RATE_LIMIT_SECONDS,
	EMAIL_VERIFICATION_TOKEN_BYTES,
	EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
} from "@repo/shared/constants";
import { RateLimitError, ValidationError } from "../../lib/errors.js";

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

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

	// 2. Invalidate any previous pending tokens for this user
	await deps.db
		.update(emailVerifications)
		.set({ verifiedAt: sql`now()` })
		.where(
			and(
				eq(emailVerifications.userId, userId),
				isNull(emailVerifications.verifiedAt),
			),
		);

	// 3. Generate token
	const rawToken = randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString("hex");
	const tokenHash = hashToken(rawToken);

	// 4. Store in DB
	const expiresAt = new Date(
		Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_SECONDS * 1000,
	);
	await deps.db.insert(emailVerifications).values({
		userId,
		email,
		tokenHash,
		expiresAt,
	});

	// 5. Enqueue email job
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

	// Atomic: find + consume token in one query
	const [verification] = await deps.db
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

	// Update user: set email + elevate role to organizer (only if participant)
	const [updatedUser] = await deps.db
		.update(users)
		.set({
			email: verification.email,
			role: "organizer",
		})
		.where(
			and(
				eq(users.id, sessionInfo.userId),
				eq(users.role, "participant"),
			),
		)
		.returning({ role: users.role });

	// If user was already organizer/admin, just update email
	if (!updatedUser) {
		await deps.db
			.update(users)
			.set({ email: verification.email })
			.where(eq(users.id, sessionInfo.userId));
	}

	const newRole = updatedUser?.role ?? "organizer";

	// Refresh Redis session with new role
	const existingSession = await deps.sessionRedis.get(
		sessionInfo.sessionId,
	);
	if (existingSession) {
		const sessionData = JSON.parse(existingSession) as Record<
			string,
			unknown
		>;
		sessionData.role = newRole;
		const ttl = await deps.sessionRedis.ttl(sessionInfo.sessionId);
		if (ttl > 0) {
			await deps.sessionRedis.set(
				sessionInfo.sessionId,
				JSON.stringify(sessionData),
				"EX",
				ttl,
			);
		}
	}

	return { role: newRole, email: verification.email };
}
