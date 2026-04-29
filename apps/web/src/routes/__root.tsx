import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { type ReactNode, useEffect } from "react";
import { NotFoundPage } from "#/components/error";
import { publicEnv } from "#/lib/env/public";
import PostHogProvider from "../integrations/posthog/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: publicEnv.VITE_APP_TITLE ?? "eventKart",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	component: RootComponent,
	notFoundComponent: NotFoundPage,
	shellComponent: RootDocument,
});

function RootComponent() {
	return (
		<ThemeProvider>
			<SentryClientInit />
			<Outlet />
			<Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
		</ThemeProvider>
	);
}

function SentryClientInit() {
	useEffect(() => {
		if (!import.meta.env.SSR) {
			void import("#/integrations/sentry/client");
		}
	}, []);

	return null;
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en-IN" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<PostHogProvider>
					{children}
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							TanStackQueryDevtools,
						]}
					/>
				</PostHogProvider>
				<Scripts />
			</body>
		</html>
	);
}
