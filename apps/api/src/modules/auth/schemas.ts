import { z } from "zod/v4";
import { phoneSchema } from "@repo/shared/schemas";

export const otpSendBodySchema = z.object({
	phone: phoneSchema,
});

export const otpSendResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		message: z.string(),
		expiresInSeconds: z.number().int().positive(),
	}),
});

export const otpErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});

export const otpVerifyBodySchema = z.object({
	phone: phoneSchema,
	otp: z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const otpVerifyResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		userId: z.string().uuid(),
		role: z.string(),
		isNewUser: z.boolean(),
	}),
});

export const logoutResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		message: z.string(),
	}),
});

export const logoutErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});
