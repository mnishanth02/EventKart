import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryBuildConfig =
	sentryAuthToken && sentryOrg && sentryProject
		? {
				authToken: sentryAuthToken,
				org: sentryOrg,
				project: sentryProject,
			}
		: null;

const config = defineConfig({
	build: {
		chunkSizeWarningLimit: 700,
		rolldownOptions: {
			checks: {
				pluginTimings: false,
			},
		},
	},
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		// Nitro Node preset reads process.env.PORT at runtime; falls back to 3000.
		// (Railway sets PORT automatically; we rely on the documented preset behaviour
		// rather than an explicit app.config.ts, which TanStack Start RC does not need.)
		nitro(),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
		...(sentryBuildConfig
			? [
					sentryTanstackStart({
						org: sentryBuildConfig.org,
						project: sentryBuildConfig.project,
						authToken: sentryBuildConfig.authToken,
						sourcemaps: {
							assets: ["./dist/**/*"],
							filesToDeleteAfterUpload: ["./dist/**/*.map"],
						},
					}),
				]
			: []),
	],
});

export default config;
