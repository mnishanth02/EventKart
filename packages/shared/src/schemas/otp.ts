import { z } from "zod/v4";
import { phoneSchema } from "./phone.js";

/** Request schema for POST /api/v1/auth/otp/send */
export const otpSendRequestSchema = z.object({
	phone: phoneSchema,
});

export type OtpSendRequest = z.input<typeof otpSendRequestSchema>;
export type OtpSendRequestParsed = z.output<typeof otpSendRequestSchema>;

/** Response data for successful OTP send */
export const otpSendDataSchema = z.object({
	message: z.string(),
	expiresInSeconds: z.number().int().positive(),
});

export type OtpSendData = z.infer<typeof otpSendDataSchema>;

/** Request schema for POST /api/v1/auth/otp/verify */
export const otpVerifyRequestSchema = z.object({
	phone: phoneSchema,
	otp: z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export type OtpVerifyRequest = z.input<typeof otpVerifyRequestSchema>;
export type OtpVerifyRequestParsed = z.output<typeof otpVerifyRequestSchema>;

/** Response data for successful OTP verification */
export const otpVerifyDataSchema = z.object({
	userId: z.string().uuid(),
	role: z.string(),
	isNewUser: z.boolean(),
});

export type OtpVerifyData = z.infer<typeof otpVerifyDataSchema>;
