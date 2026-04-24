export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RATE_LIMIT_WINDOW_SECONDS = 60;

export const OTP_DELIVERY_MODES = ["msg91", "log"] as const;
export type OtpDeliveryMode = (typeof OTP_DELIVERY_MODES)[number];
