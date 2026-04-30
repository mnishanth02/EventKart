import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Parses string-encoded booleans from environment variables.
 *
 * Vite inlines `import.meta.env.VITE_*` values as strings. `z.coerce.boolean()`
 * uses JavaScript truthiness, so the literal string `"false"` (and `"0"`) would
 * coerce to `true` — defeating an opt-in feature flag. This schema accepts only
 * an explicit `"true"` / `"1"` (case-insensitive) as `true`; everything else
 * (including missing, empty, `"false"`, `"0"`, or any unknown string) is `false`.
 */
export const stringBoolEnv = z
	.union([z.boolean(), z.string()])
	.optional()
	.default(false)
	.transform((value) => {
		if (typeof value === "boolean") {
			return value;
		}
		const normalized = value.trim().toLowerCase();
		return normalized === "true" || normalized === "1";
	});

export const publicEnv = createEnv({
	server: {},
	clientPrefix: "VITE_",
	client: {
		VITE_APP_TITLE: z.string().min(1).optional(),
		VITE_API_URL: z.string().url(),
		VITE_POSTHOG_KEY: z.string().min(1).optional(),
		VITE_POSTHOG_HOST: z.string().url().optional(),
		VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED: stringBoolEnv,
		VITE_SENTRY_DSN: z.string().min(1).optional(),
		VITE_SENTRY_ENVIRONMENT: z.string().min(1).optional(),
		VITE_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
		VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: z.coerce
			.number()
			.min(0)
			.max(1)
			.optional(),
		VITE_SITE_URL: z
			.string()
			.url()
			.refine(
				(value) => {
					try {
						const protocol = new URL(value).protocol;
						return protocol === "http:" || protocol === "https:";
					} catch {
						return false;
					}
				},
				{ message: "VITE_SITE_URL must be an http(s) URL" },
			)
			.optional(),
	},
	runtimeEnv: import.meta.env,
	emptyStringAsUndefined: true,
});
