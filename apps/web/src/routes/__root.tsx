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

// Synchronous (non-module) stub installed BEFORE any deferred module script
// evaluates. Lazy-loaded route chunks transformed by @vitejs/plugin-react
// reference $RefreshReg$/$RefreshSig$ at module top-level; without these
// no-op stubs in scope before evaluation, the chunk throws
// `ReferenceError: $RefreshReg$ is not defined`. Module scripts (including
// the runtime preamble below) are deferred and may not have run yet when a
// dynamic import resolves, so the parser-blocking script is required.
const REACT_REFRESH_STUB_SCRIPT = `
window.$RefreshReg$ = function () {};
window.$RefreshSig$ = function () { return function (type) { return type; }; };
`;

const REACT_REFRESH_PREAMBLE_SCRIPT = `
import RefreshRuntime from "/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
`;

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
		scripts: import.meta.env.PROD
			? []
			: [
					{
						// Parser-blocking stub installed inside <head>: must execute
						// synchronously before any deferred module script (including
						// the preamble in <body>) so dynamically-imported route
						// chunks transformed by @vitejs/plugin-react never observe
						// an undefined $RefreshReg$/$RefreshSig$ during top-level
						// evaluation. Without this, lazy chunks importing component
						// files from packages/ui (e.g. alert.tsx) throw
						// `ReferenceError: $RefreshReg$ is not defined`.
						children: REACT_REFRESH_STUB_SCRIPT,
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
				{import.meta.env.MODE === "development" ? (
					<script
						type="module"
						// TanStack Start serves SSR HTML directly in dev, so Vite's
						// HTML transform does not inject the React Refresh preamble.
						// biome-ignore lint/security/noDangerouslySetInnerHtml: <false positive>
						dangerouslySetInnerHTML={{
							__html: REACT_REFRESH_PREAMBLE_SCRIPT,
						}}
					/>
				) : null}
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
