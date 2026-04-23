import type { ErrorEvent, EventHint } from "@sentry/node";
import * as Sentry from "@sentry/node";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";

let sentryActive = false;

/** Fields whose values must be fully redacted in Sentry events. */
const REDACT_FIELDS = new Set([
	"phone",
	"email",
	"password",
	"token",
	"secret",
	"creditcard",
	"cookie",
	"authorization",
]);

/** Headers stripped from Sentry request data. */
const REDACT_HEADERS = new Set(["cookie", "authorization", "x-internal-key"]);

const PHONE_PATTERN = /(\+91[\s-]?\d{10}|\b\d{10}\b)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Recursively walk an object and replace values whose keys match a PII field
 * name. Primitive string values also get phone/email pattern replacement.
 */
function scrubObject(obj: unknown): unknown {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj === "string") {
		return obj
			.replace(PHONE_PATTERN, "[REDACTED_PHONE]")
			.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
	}

	if (Array.isArray(obj)) {
		return obj.map(scrubObject);
	}

	if (typeof obj === "object") {
		const scrubbed: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			if (REDACT_FIELDS.has(key.toLowerCase())) {
				scrubbed[key] = "[REDACTED]";
			} else {
				scrubbed[key] = scrubObject(value);
			}
		}
		return scrubbed;
	}

	return obj;
}

/**
 * Sentry `beforeSend` hook – strips PII from events before they leave the
 * process. Mirrors the Pino redaction list so no sensitive data leaks into
 * Sentry either.
 */
function scrubPii(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
	// Scrub error messages
	if (event.message) {
		event.message = event.message
			.replace(PHONE_PATTERN, "[REDACTED_PHONE]")
			.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
	}

	// Scrub exception values
	if (event.exception?.values) {
		for (const exception of event.exception.values) {
			if (exception.value) {
				exception.value = exception.value
					.replace(PHONE_PATTERN, "[REDACTED_PHONE]")
					.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
			}
		}
	}

	// Scrub request headers
	if (event.request?.headers) {
		for (const header of REDACT_HEADERS) {
			if (header in event.request.headers) {
				event.request.headers[header] = "[REDACTED]";
			}
		}
	}

	// Scrub request data / query string / cookies
	if (event.request?.data) {
		event.request.data = scrubObject(event.request.data);
	}
	if (event.request?.query_string) {
		event.request.query_string = scrubObject(
			event.request.query_string,
		) as string;
	}
	if (event.request?.cookies) {
		event.request.cookies = {};
	}

	// Scrub extra context
	if (event.extra) {
		event.extra = scrubObject(event.extra) as Record<string, unknown>;
	}

	// Scrub breadcrumb data
	if (event.breadcrumbs) {
		for (const breadcrumb of event.breadcrumbs) {
			if (breadcrumb.data) {
				breadcrumb.data = scrubObject(breadcrumb.data) as Record<
					string,
					unknown
				>;
			}
		}
	}

	return event;
}

/**
 * Initialise the Sentry SDK. Safe to call when `SENTRY_DSN` is not set – it
 * becomes a no-op and returns `false`.
 */
export function initSentry(config: AppConfig): boolean {
	if (!config.SENTRY_DSN) {
		return false;
	}

	Sentry.init({
		dsn: config.SENTRY_DSN,
		environment:
			config.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
		...(config.SENTRY_RELEASE ? { release: config.SENTRY_RELEASE } : {}),
		tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
		integrations: [Sentry.fastifyIntegration()],
		beforeSend: scrubPii,
	});

	sentryActive = true;
	return true;
}

/** Whether Sentry was successfully initialised in this process. */
export function isSentryActive(): boolean {
	return sentryActive;
}

/**
 * Register Sentry's Fastify error handler on the app instance. Must be called
 * AFTER all routes are registered so the handler sits at the end of the chain.
 */
export function setupFastifyErrorHandler(app: FastifyInstance): void {
	Sentry.setupFastifyErrorHandler(app);
}

/**
 * Convenience wrapper for `Sentry.captureException`. Attaches extras to the
 * current scope and silently no-ops when Sentry is inactive.
 */
export function captureUnexpectedError(
	error: unknown,
	extras?: Record<string, unknown>,
): void {
	if (!sentryActive) {
		return;
	}

	Sentry.captureException(error, {
		extra: extras,
	});
}

/** Flush pending events and shut down the Sentry SDK gracefully. */
export async function flushSentry(): Promise<void> {
	if (!sentryActive) {
		return;
	}

	await Sentry.close(2000);
	sentryActive = false;
}
