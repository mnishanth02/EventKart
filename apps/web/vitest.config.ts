import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		passWithNoTests: true,
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: ["node_modules", "dist", ".git", ".tanstack", ".output", ".nitro"],
	},
});
