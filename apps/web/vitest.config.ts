import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
			"@ui": path.resolve(__dirname, "../../packages/ui/src"),
		},
	},
	test: {
		environment: "jsdom",
		passWithNoTests: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: ["node_modules", "dist", ".git", ".tanstack", ".output", ".nitro"],
	},
});
