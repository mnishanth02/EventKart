import { z } from "zod";

if (typeof window !== "undefined") {
	throw new Error("serverEnv must only be imported on the server.");
}

const optionalUrl = z.preprocess(
	(value) => (value === "" ? undefined : value),
	z.string().url().optional(),
);

const optionalString = z.preprocess(
	(value) => (value === "" ? undefined : value),
	z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
	INTERNAL_API_URL: optionalUrl,
	SERVER_URL: optionalUrl,
	INTERNAL_API_KEY: optionalString,
	SENTRY_DSN: optionalString,
	SENTRY_ENVIRONMENT: optionalString,
	SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
	SENTRY_AUTH_TOKEN: optionalString,
	SENTRY_ORG: optionalString,
	SENTRY_PROJECT: optionalString,
});

export const serverEnv = serverEnvSchema.parse({
	INTERNAL_API_URL: process.env.INTERNAL_API_URL,
	SERVER_URL: process.env.SERVER_URL,
	INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
	SENTRY_DSN: process.env.SENTRY_DSN,
	SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
	SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
	SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
	SENTRY_ORG: process.env.SENTRY_ORG,
	SENTRY_PROJECT: process.env.SENTRY_PROJECT,
});
