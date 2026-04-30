import { loadEnvFile } from "node:process";
import { type Static, Type } from "@sinclair/typebox";
import envSchema from "env-schema";

let hasLoadedEnvFile = false;

function ensureEnvLoaded() {
	if (hasLoadedEnvFile) {
		return;
	}

	try {
		loadEnvFile();
	} catch (error) {
		const code =
			typeof error === "object" && error !== null && "code" in error
				? error.code
				: undefined;

		if (code !== "ENOENT") {
			throw error;
		}
	}

	hasLoadedEnvFile = true;
}

function normalizeConfigData(data: Record<string, unknown>) {
	const normalizedData = { ...data };

	if (normalizedData.DATABASE_URL === "") {
		delete normalizedData.DATABASE_URL;
	}

	if (normalizedData.INTERNAL_API_KEY === "") {
		delete normalizedData.INTERNAL_API_KEY;
	}

	if (normalizedData.S3_ENDPOINT === "") {
		delete normalizedData.S3_ENDPOINT;
	}

	if (normalizedData.S3_ACCESS_KEY_ID === "") {
		delete normalizedData.S3_ACCESS_KEY_ID;
	}

	if (normalizedData.S3_SECRET_ACCESS_KEY === "") {
		delete normalizedData.S3_SECRET_ACCESS_KEY;
	}

	if (normalizedData.S3_BUCKET === "") {
		delete normalizedData.S3_BUCKET;
	}

	if (normalizedData.MSG91_AUTH_KEY === "") {
		delete normalizedData.MSG91_AUTH_KEY;
	}

	if (normalizedData.MSG91_OTP_TEMPLATE_ID === "") {
		delete normalizedData.MSG91_OTP_TEMPLATE_ID;
	}

	if (normalizedData.COOKIE_DOMAIN === "") {
		delete normalizedData.COOKIE_DOMAIN;
	}

	if (normalizedData.ADMIN_IP_ALLOWLIST === "") {
		delete normalizedData.ADMIN_IP_ALLOWLIST;
	}

	if (normalizedData.RESEND_API_KEY === "") {
		delete normalizedData.RESEND_API_KEY;
	}

	if (normalizedData.OTEL_EXPORTER_OTLP_ENDPOINT === "") {
		delete normalizedData.OTEL_EXPORTER_OTLP_ENDPOINT;
	}

	if (normalizedData.OTEL_EXPORTER_OTLP_HEADERS === "") {
		delete normalizedData.OTEL_EXPORTER_OTLP_HEADERS;
	}

	if (normalizedData.SENTRY_DSN === "") {
		delete normalizedData.SENTRY_DSN;
	}

	if (normalizedData.SENTRY_ENVIRONMENT === "") {
		delete normalizedData.SENTRY_ENVIRONMENT;
	}

	if (normalizedData.SENTRY_RELEASE === "") {
		delete normalizedData.SENTRY_RELEASE;
	}

	if (normalizedData.OTEL_METRICS_EXPORT_INTERVAL_MS === "") {
		delete normalizedData.OTEL_METRICS_EXPORT_INTERVAL_MS;
	}

	if (normalizedData.RAZORPAY_KEY_ID === "") {
		delete normalizedData.RAZORPAY_KEY_ID;
	}

	if (normalizedData.RAZORPAY_KEY_SECRET === "") {
		delete normalizedData.RAZORPAY_KEY_SECRET;
	}

	return normalizedData;
}

function parseWebOrigin(value: string) {
	try {
		const url = new URL(value);

		const isValidProtocol =
			url.protocol === "http:" || url.protocol === "https:";

		if (!isValidProtocol) {
			return null;
		}

		const hasOriginShape =
			url.pathname === "/" && url.search === "" && url.hash === "";

		return hasOriginShape ? url : null;
	} catch {
		return null;
	}
}

export const appConfigSchema = Type.Object({
	HOST: Type.String({ default: "0.0.0.0" }),
	PORT: Type.Integer({ default: 3001, minimum: 1, maximum: 65535 }),
	LOG_LEVEL: Type.Union(
		[
			Type.Literal("trace"),
			Type.Literal("debug"),
			Type.Literal("info"),
			Type.Literal("warn"),
			Type.Literal("error"),
			Type.Literal("fatal"),
		],
		{ default: "info" },
	),
	WEB_ORIGIN: Type.String({ default: "http://localhost:3000" }),
	DATABASE_URL: Type.String({ minLength: 1 }),
	REDIS_URL: Type.String({ default: "redis://localhost:6379" }),
	INTERNAL_API_KEY: Type.Optional(Type.String({ minLength: 1 })),
	S3_ENDPOINT: Type.Optional(Type.String({ minLength: 1 })),
	S3_REGION: Type.Optional(Type.String({ default: "auto" })),
	S3_ACCESS_KEY_ID: Type.Optional(Type.String({ minLength: 1 })),
	S3_SECRET_ACCESS_KEY: Type.Optional(Type.String({ minLength: 1 })),
	S3_BUCKET: Type.Optional(Type.String({ minLength: 1 })),
	S3_FORCE_PATH_STYLE: Type.Optional(Type.Boolean({ default: true })),
	MSG91_AUTH_KEY: Type.Optional(Type.String({ minLength: 1 })),
	MSG91_OTP_TEMPLATE_ID: Type.Optional(Type.String({ minLength: 1 })),
	OTP_DELIVERY_MODE: Type.Union([Type.Literal("msg91"), Type.Literal("log")], {
		default: "log",
	}),
	COOKIE_DOMAIN: Type.Optional(Type.String({ minLength: 1 })),
	OTP_HMAC_SECRET: Type.String({ default: "eventkart-otp-hash-v1" }),
	CSRF_SECRET: Type.String({ default: "eventkart-csrf-secret-v1" }),
	ADMIN_IP_ALLOWLIST: Type.Optional(Type.String({ minLength: 1 })),
	RESEND_API_KEY: Type.Optional(Type.String({ minLength: 1 })),
	EMAIL_FROM: Type.String({ default: "EventKart <noreply@eventkart.app>" }),
	OTEL_SERVICE_NAME: Type.String({ default: "eventkart-api" }),
	OTEL_EXPORTER_OTLP_ENDPOINT: Type.Optional(Type.String({ minLength: 1 })),
	OTEL_EXPORTER_OTLP_HEADERS: Type.Optional(Type.String({ minLength: 1 })),
	SENTRY_DSN: Type.Optional(Type.String({ minLength: 1 })),
	SENTRY_ENVIRONMENT: Type.Optional(Type.String({ minLength: 1 })),
	SENTRY_RELEASE: Type.Optional(Type.String({ minLength: 1 })),
	SENTRY_TRACES_SAMPLE_RATE: Type.Optional(
		Type.Number({ minimum: 0, maximum: 1 }),
	),
	LOG_PRETTY: Type.Optional(Type.Boolean({ default: false })),
	OTEL_METRICS_EXPORT_INTERVAL_MS: Type.Optional(
		Type.Integer({ default: 60000, minimum: 1000, maximum: 300000 }),
	),
	RAZORPAY_KEY_ID: Type.Optional(Type.String({ minLength: 1 })),
	RAZORPAY_KEY_SECRET: Type.Optional(Type.String({ minLength: 1 })),
	PUBLIC_SPOTS_REMAINING_BADGE_ENABLED: Type.Optional(
		Type.Boolean({ default: false }),
	),
});

export type AppConfig = Static<typeof appConfigSchema>;

export function loadConfig(
	data: Record<string, unknown> = process.env,
): AppConfig {
	ensureEnvLoaded();

	const config = envSchema<AppConfig>({
		schema: appConfigSchema,
		env: false,
		data: normalizeConfigData({
			...process.env,
			...data,
		}),
	});

	const webOrigin = parseWebOrigin(config.WEB_ORIGIN);

	if (!webOrigin) {
		throw new Error(
			"Invalid configuration: WEB_ORIGIN must be an absolute origin without a path, query, or hash.",
		);
	}

	if (config.OTP_DELIVERY_MODE === "msg91" && !config.MSG91_AUTH_KEY) {
		throw new Error(
			"Invalid configuration: OTP_DELIVERY_MODE is 'msg91' but MSG91_AUTH_KEY is not set.",
		);
	}

	// Reject known default secrets in production
	const INSECURE_DEFAULTS = [
		"eventkart-otp-hash-v1",
		"eventkart-csrf-secret-v1",
	];
	if (
		process.env.NODE_ENV === "production" &&
		(INSECURE_DEFAULTS.includes(config.OTP_HMAC_SECRET) ||
			INSECURE_DEFAULTS.includes(config.CSRF_SECRET))
	) {
		throw new Error(
			"Invalid configuration: OTP_HMAC_SECRET and CSRF_SECRET must be set to strong random values in production.",
		);
	}

	return {
		...config,
		WEB_ORIGIN: webOrigin.origin,
	};
}
