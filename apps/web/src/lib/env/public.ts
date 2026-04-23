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
	},
	runtimeEnv: import.meta.env,
	emptyStringAsUndefined: true,
});
