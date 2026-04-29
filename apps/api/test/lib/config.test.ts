import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/lib/config.js";

const originalInternalApiKey = process.env.INTERNAL_API_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreEnvValue(key: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[key];
		return;
	}

	process.env[key] = value;
}

describe("loadConfig", () => {
	afterEach(() => {
		restoreEnvValue("INTERNAL_API_KEY", originalInternalApiKey);
		restoreEnvValue("DATABASE_URL", originalDatabaseUrl);
	});

	it("loadConfig strips INTERNAL_API_KEY when explicitly set to empty string, even if process.env provides a value", () => {
		process.env.INTERNAL_API_KEY = "real-key";
		process.env.DATABASE_URL =
			"postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev";

		const config = loadConfig({ INTERNAL_API_KEY: "" });

		expect(config.INTERNAL_API_KEY).toBeUndefined();
		expect("INTERNAL_API_KEY" in config).toBe(false);
	});
});
