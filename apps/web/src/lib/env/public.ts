import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const publicEnv = createEnv({
	server: {},
	clientPrefix: "VITE_",
	client: {
		VITE_APP_TITLE: z.string().min(1).optional(),
		VITE_API_URL: z.string().url(),
		VITE_POSTHOG_KEY: z.string().min(1).optional(),
		VITE_POSTHOG_HOST: z.string().url().optional(),
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
