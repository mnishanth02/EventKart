import { z } from "zod";

if (typeof window !== "undefined") {
	throw new Error("serverEnv must only be imported on the server.");
}

const optionalUrl = z.preprocess(
	(value) => (value === "" ? undefined : value),
	z.string().url().optional(),
);

const serverEnvSchema = z.object({
	INTERNAL_API_URL: optionalUrl,
	SERVER_URL: optionalUrl,
});

export const serverEnv = serverEnvSchema.parse({
	INTERNAL_API_URL: process.env.INTERNAL_API_URL,
	SERVER_URL: process.env.SERVER_URL,
});
