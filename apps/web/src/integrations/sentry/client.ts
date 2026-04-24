import * as Sentry from "@sentry/tanstackstart-react";
import type { ErrorEvent } from "@sentry/tanstackstart-react";
import { publicEnv } from "#/lib/env/public";

const PHONE_PATTERN = /\+\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SENSITIVE_KEYS = new Set([
	"password",
	"passwd",
	"secret",
	"token",
	"cookie",
	"authorization",
	"credit_card",
	"card_number",
	"cvv",
	"ssn",
	"aadhaar",
	"pan",
]);

function isSensitiveKey(key: string): boolean {
	return SENSITIVE_KEYS.has(key.toLowerCase());
}

function redactString(value: string): string {
	return value
		.replace(PHONE_PATTERN, "[REDACTED_PHONE]")
		.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
}

function scrubObject(
	obj: Record<string, unknown>,
): Record<string, unknown> {
	const scrubbed: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (isSensitiveKey(key)) {
			scrubbed[key] = "[REDACTED]";
		} else if (typeof value === "string") {
			scrubbed[key] = redactString(value);
		} else if (Array.isArray(value)) {
			scrubbed[key] = value.map((item) =>
				typeof item === "string"
					? redactString(item)
					: typeof item === "object" && item !== null && !Array.isArray(item)
						? scrubObject(item as Record<string, unknown>)
						: item,
			);
		} else if (typeof value === "object" && value !== null) {
			scrubbed[key] = scrubObject(value as Record<string, unknown>);
		} else {
			scrubbed[key] = value;
		}
	}
	return scrubbed;
}

function scrubPii(event: ErrorEvent): ErrorEvent {
	if (event.exception?.values) {
		for (const exception of event.exception.values) {
			if (exception.value) {
				exception.value = redactString(exception.value);
			}
		}
	}

	if (event.message) {
		event.message = redactString(event.message);
	}

	if (event.breadcrumbs) {
		for (const breadcrumb of event.breadcrumbs) {
			if (breadcrumb.message) {
				breadcrumb.message = redactString(breadcrumb.message);
			}
			if (breadcrumb.data && typeof breadcrumb.data === "object") {
				breadcrumb.data = scrubObject(
					breadcrumb.data as Record<string, unknown>,
				);
			}
		}
	}

	if (event.extra && typeof event.extra === "object") {
		event.extra = scrubObject(event.extra as Record<string, unknown>);
	}

	if (event.request?.headers) {
		event.request.headers = scrubObject(
			event.request.headers as Record<string, unknown>,
		) as Record<string, string>;
	}

	if (event.request?.cookies) {
		event.request.cookies = scrubObject(
			event.request.cookies as Record<string, unknown>,
		) as Record<string, string>;
	}

	return event;
}

export function initSentryClient(): void {
	if (typeof window === "undefined") return;
	if (!publicEnv.VITE_SENTRY_DSN) return;

	Sentry.init({
		dsn: publicEnv.VITE_SENTRY_DSN,
		environment: publicEnv.VITE_SENTRY_ENVIRONMENT ?? "development",
		tracesSampleRate: publicEnv.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
		replaysSessionSampleRate:
			publicEnv.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0,
		replaysOnErrorSampleRate: 1.0,
		integrations: [
			Sentry.browserTracingIntegration(),
			Sentry.replayIntegration(),
		],
		beforeSend(event) {
			return scrubPii(event);
		},
	});
}

// Initialize immediately on module load (browser only)
initSentryClient();
