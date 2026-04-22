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
});

export const serverEnv = serverEnvSchema.parse({
	INTERNAL_API_URL: process.env.INTERNAL_API_URL,
	SERVER_URL: process.env.SERVER_URL,
	INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
});
