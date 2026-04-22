export class AppError extends Error {
	readonly statusCode: number;
	readonly code: string;
	readonly details?: Record<string, unknown>;

	constructor(
		message: string,
		statusCode: number,
		code: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
	}
}

export class RateLimitError extends AppError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 429, "RATE_LIMITED", details);
		this.name = "RateLimitError";
	}
}

export class ValidationError extends AppError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 400, "VALIDATION_ERROR", details);
		this.name = "ValidationError";
	}
}

export class OtpDeliveryError extends AppError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 502, "OTP_DELIVERY_FAILED", details);
		this.name = "OtpDeliveryError";
	}
}

export class OtpRateLimitError extends AppError {
	constructor(retryAfterSeconds: number) {
		super("Please wait before requesting another OTP", 429, "OTP_RATE_LIMITED", {
			retryAfterSeconds,
		});
		this.name = "OtpRateLimitError";
	}
}

export class OtpExpiredError extends AppError {
	constructor() {
		super("OTP has expired or was not found", 400, "OTP_EXPIRED");
		this.name = "OtpExpiredError";
	}
}

export class OtpInvalidError extends AppError {
	constructor(attemptsRemaining: number) {
		super("Invalid OTP", 400, "OTP_INVALID", { attemptsRemaining });
		this.name = "OtpInvalidError";
	}
}

export class OtpMaxAttemptsError extends AppError {
	constructor() {
		super(
			"Too many failed attempts. Please request a new OTP.",
			429,
			"OTP_MAX_ATTEMPTS_EXCEEDED",
		);
		this.name = "OtpMaxAttemptsError";
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "Authentication required") {
		super(message, 401, "UNAUTHORIZED");
		this.name = "UnauthorizedError";
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "Forbidden", code = "FORBIDDEN") {
		super(message, 403, code);
		this.name = "ForbiddenError";
	}
}

export class InsufficientRoleError extends AppError {
	constructor(requiredRole: string) {
		super(
			`Insufficient permissions. ${requiredRole} role required`,
			403,
			"INSUFFICIENT_ROLE",
			{ requiredRole },
		);
		this.name = "InsufficientRoleError";
	}
}

export class CsrfError extends ForbiddenError {
	constructor() {
		super("Invalid or missing CSRF token", "CSRF_VALIDATION_FAILED");
		this.name = "CsrfError";
	}
}

export class IpNotAllowedError extends ForbiddenError {
	constructor() {
		super("Access denied: IP address not allowed", "IP_NOT_ALLOWED");
		this.name = "IpNotAllowedError";
	}
}

export class ConflictError extends AppError {
	constructor(message = "Resource already exists") {
		super(message, 409, "CONFLICT");
		this.name = "ConflictError";
	}
}
