import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { AppConfig } from "../../lib/config.js";
import type { Database } from "@repo/db";
import { users, sessions } from "@repo/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
	OtpDeliveryError,
	OtpExpiredError,
	OtpInvalidError,
	OtpMaxAttemptsError,
	OtpRateLimitError,
} from "../../lib/errors.js";
import type { Msg91Config, OtpDeliveryResult } from "../../lib/msg91.js";
import { sendOtpWithFallback } from "../../lib/msg91.js";
import {
	acquireOtpSendLock,
	generateOtp,
	getOtpCooldownTtl,
	releaseOtpSendLock,
	shortenOtpCooldown,
	storeOtp,
	verifyAndConsumeOtp,
} from "../../lib/otp.js";
import {
	generateSessionId,
	createRedisSession,
	deleteRedisSession,
	type SessionData,
} from "../../lib/session.js";
import { OTP_TTL_SECONDS, SESSION_TTL_SECONDS } from "@repo/shared/constants";
import {
	otpSendTotal,
	otpVerifyTotal,
	funnelStepTotal,
} from "../../lib/metrics.js";

export interface OtpSendDeps {
	redis: Redis;
	config: AppConfig;
	log: FastifyBaseLogger;
}

export interface OtpSendResult {
	message: string;
	expiresInSeconds: number;
}

export interface OtpVerifyDeps {
	otpRedis: Redis;
	sessionRedis: Redis;
	db: Database;
	config: AppConfig;
	log: FastifyBaseLogger;
	ip?: string;
	userAgent?: string;
}

export interface OtpVerifyResult {
	sessionId: string;
	userId: string;
	role: string;
	isNewUser: boolean;
}

export async function sendOtpForPhone(
	deps: OtpSendDeps,
	phone: string,
): Promise<OtpSendResult> {
	const { redis, config, log } = deps;

	// Atomic rate-limit check + lock acquisition
	const lockAcquired = await acquireOtpSendLock(redis, phone);

	if (!lockAcquired) {
		otpSendTotal.add(1, { status: "rate_limited" });
		const cooldown = await getOtpCooldownTtl(redis, phone);
		throw new OtpRateLimitError(cooldown);
	}

	// Generate OTP
	const otp = generateOtp();

	// Send via configured delivery mode
	let channel: "sms" | "whatsapp" | "log" = "log";

	if (config.OTP_DELIVERY_MODE === "msg91") {
		const msg91Config: Msg91Config = {
			authKey: config.MSG91_AUTH_KEY!,
			templateId: config.MSG91_OTP_TEMPLATE_ID,
		};

		let result: OtpDeliveryResult;
		try {
			result = await sendOtpWithFallback(phone, otp, msg91Config, log);
		} catch (error) {
			// Delivery threw unexpectedly — release the cooldown lock
			// so the user can retry immediately
			await releaseOtpSendLock(redis, phone);
			throw error;
		}

		if (!result.success) {
			// Delivery failed gracefully — shorten cooldown to allow quick retry
			await shortenOtpCooldown(redis, phone, 5);
			otpSendTotal.add(1, { status: "delivery_error" });
			throw new OtpDeliveryError(
				"Unable to send OTP. Please try again later.",
				{ channel: result.channel, error: result.error },
			);
		}

		channel = result.channel;
	} else {
		// Dev/log mode — log OTP for local development
		log.info(
			{ phone: phone.slice(0, 6) + "****", otp },
			"OTP generated (log mode)",
		);
	}

	// Store hashed OTP in Redis
	await storeOtp(redis, phone, otp, channel, config.OTP_HMAC_SECRET);

	otpSendTotal.add(1, { status: "success" });
	funnelStepTotal.add(1, { step: "otp_sent" });

	return {
		message: "OTP sent successfully",
		expiresInSeconds: OTP_TTL_SECONDS,
	};
}

/**
 * Verify an OTP, upsert the user, and create a session.
 *
 * Flow:
 * 1. Atomic OTP verify+consume via Lua script
 * 2. Upsert user (INSERT ON CONFLICT DO NOTHING + SELECT)
 * 3. Dual-write session (Redis + DB), fail-closed with compensation
 * 4. Return session data for cookie
 */
export async function verifyOtpAndCreateSession(
	deps: OtpVerifyDeps,
	phone: string,
	otp: string,
): Promise<OtpVerifyResult> {
	const { otpRedis, sessionRedis, db, config, log, ip, userAgent } = deps;

	// 1. Atomic OTP verification
	const otpResult = await verifyAndConsumeOtp(
		otpRedis,
		phone,
		otp,
		config.OTP_HMAC_SECRET,
	);

	switch (otpResult.status) {
		case "expired":
			otpVerifyTotal.add(1, { status: "expired" });
			throw new OtpExpiredError();
		case "invalid":
			otpVerifyTotal.add(1, { status: "invalid" });
			throw new OtpInvalidError(otpResult.attemptsRemaining);
		case "max_attempts":
			otpVerifyTotal.add(1, { status: "max_attempts" });
			throw new OtpMaxAttemptsError();
		case "success":
			break;
	}

	// 2. Upsert user: INSERT ON CONFLICT DO NOTHING, then SELECT if needed
	let isNewUser = false;

	const insertResult = await db
		.insert(users)
		.values({
			phone,
			role: "participant",
		})
		.onConflictDoNothing({
			target: users.phone,
		})
		.returning({
			id: users.id,
			role: users.role,
		});

	let userId: string;
	let role: string;

	if (insertResult.length > 0) {
		// New user created
		isNewUser = true;
		userId = insertResult[0]!.id;
		role = insertResult[0]!.role;
		log.info({ userId, phone: phone.slice(0, 6) + "****" }, "New user created");
	} else {
		// Existing user — fetch their current data
		const existingUser = await db
			.select({ id: users.id, role: users.role })
			.from(users)
			.where(and(eq(users.phone, phone), isNull(users.deletedAt)))
			.limit(1);

		if (!existingUser[0]) {
			// This shouldn't happen: conflict means user exists, but SELECT found nothing.
			// Could be a concurrent soft-delete. Treat as error.
			log.error({ phone: phone.slice(0, 6) + "****" }, "User conflict but not found on SELECT");
			throw new Error("User lookup failed after conflict");
		}

		userId = existingUser[0].id;
		role = existingUser[0].role;
	}

	// 3. Create session — dual-write (Redis + DB), fail-closed
	const sessionId = generateSessionId();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

	const sessionData: SessionData = {
		userId,
		role,
		expiresAt: expiresAt.toISOString(),
	};

	// Write to Redis first (primary session store)
	await createRedisSession(sessionRedis, sessionId, sessionData);

	// Write metadata to DB (audit trail)
	try {
		await db.insert(sessions).values({
			id: sessionId,
			userId,
			expiresAt,
			ipAddress: ip ?? null,
			userAgent: userAgent ?? null,
		});
	} catch (dbError) {
		// Compensate: delete the Redis session to prevent an orphaned session
		log.error(dbError, "Failed to write session to DB, compensating");
		await deleteRedisSession(sessionRedis, sessionId);
		throw dbError;
	}

	log.info(
		{ userId, sessionId, isNewUser },
		"Session created",
	);

	otpVerifyTotal.add(1, { status: "success" });
	funnelStepTotal.add(1, { step: "otp_verified" });

	return {
		sessionId,
		userId,
		role,
		isNewUser,
	};
}

export interface LogoutDeps {
	sessionRedis: Redis;
	db: Database;
	log: FastifyBaseLogger;
}

export async function logoutSession(
	deps: LogoutDeps,
	sessionId: string,
): Promise<void> {
	const { sessionRedis, db, log } = deps;

	// Delete from Redis first (invalidates session immediately)
	await deleteRedisSession(sessionRedis, sessionId);

	// Mark as revoked in DB (audit trail)
	try {
		await db
			.update(sessions)
			.set({ revokedAt: new Date() })
			.where(eq(sessions.id, sessionId));
	} catch (dbError) {
		// Redis deletion succeeded — session is already invalidated.
		// Log the DB error but don't throw (fail-open for audit).
		log.error(
			{ err: dbError, sessionId },
			"Failed to mark session as revoked in DB",
		);
	}

	log.info({ sessionId }, "Session revoked");
}
