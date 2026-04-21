import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import type { ReactNode } from "react";
import { publicEnv } from "#/lib/env/public";

if (typeof window !== "undefined" && publicEnv.VITE_POSTHOG_KEY) {
	posthog.init(publicEnv.VITE_POSTHOG_KEY, {
		api_host: publicEnv.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
		person_profiles: "identified_only",
		capture_pageview: false,
		defaults: "2025-11-30",
	});
}

interface PostHogProviderProps {
	children: ReactNode;
}

export default function PostHogProvider({ children }: PostHogProviderProps) {
	return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>;
}
