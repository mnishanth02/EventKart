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

	if (normalizedData.INTERNAL_API_KEY === "") {
		delete normalizedData.INTERNAL_API_KEY;
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
	INTERNAL_API_KEY: Type.Optional(Type.String({ minLength: 1 })),
});

export type AppConfig = Static<typeof appConfigSchema>;

export function loadConfig(
	data: Record<string, unknown> = process.env,
): AppConfig {
	ensureEnvLoaded();

	const config = envSchema<AppConfig>({
		schema: appConfigSchema,
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

	return {
		...config,
		WEB_ORIGIN: webOrigin.origin,
	};
}
