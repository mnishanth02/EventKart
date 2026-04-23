import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

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
		nitro(),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
		...(process.env.SENTRY_AUTH_TOKEN
			? [
					sentryTanstackStart({
						org: process.env.SENTRY_ORG!,
						project: process.env.SENTRY_PROJECT!,
						authToken: process.env.SENTRY_AUTH_TOKEN,
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
