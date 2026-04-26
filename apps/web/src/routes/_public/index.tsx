import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { useRequireAuth } from "#/features/auth/hooks";

const searchSchema = z.object({
	reason: z.enum(["auth-required", "forbidden"]).optional().catch(undefined),
	redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_public/")({
	component: Home,
	validateSearch: searchSchema,
});

function Home() {
	const { reason, redirect } = Route.useSearch();
	const navigate = useNavigate();
	const { requireAuth, loginDialog } = useRequireAuth();
	const safeRedirect = getSafeRedirect(redirect);

	useEffect(() => {
		if (reason === "auth-required") {
			toast.error("Please sign in to access that page");
			if (!safeRedirect) {
				void navigate({ to: "/", replace: true });
			}
		} else if (reason === "forbidden") {
			toast.error("You don't have access to that area");
			void navigate({ to: "/", replace: true });
		}
	}, [reason, safeRedirect, navigate]);

	function handleSignInRedirect() {
		if (!safeRedirect) return;
		requireAuth(() => {
			window.location.assign(safeRedirect);
		});
	}

	return (
		<div className="page-wrap py-12 md:py-16">
			{reason === "auth-required" && safeRedirect ? (
				<div className="mb-8 rounded-xl border border-border bg-card p-4 text-center shadow-sm">
					<p className="text-sm text-muted-foreground">
						Sign in to continue to your requested page.
					</p>
					<div className="mt-3 flex justify-center gap-2">
						<Button type="button" onClick={handleSignInRedirect}>
							Sign In & Continue
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => void navigate({ to: "/", replace: true })}
						>
							Stay Here
						</Button>
					</div>
				</div>
			) : null}

			{/* Hero section */}
			<section className="rise-in space-y-4 text-center">
				<Badge variant="secondary" className="text-xs font-semibold">
					Coimbatore&apos;s Running Community
				</Badge>
				<h1 className="display-title text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
					Find your next race
				</h1>
				<p className="mx-auto max-w-lg text-base text-muted-foreground md:text-lg">
					Discover running events, register in seconds, and show up ready to
					run.
				</p>
			</section>

			<Separator className="my-12 md:my-16" />

			{/* Placeholder sections — to be replaced with real event discovery */}
			<section className="space-y-6">
				<h2 className="text-xl font-semibold">This Weekend in Coimbatore</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
					<EventCardPlaceholder />
					<EventCardPlaceholder />
					<EventCardPlaceholder />
				</div>
			</section>

			<section className="mt-12 space-y-6 md:mt-16">
				<h2 className="text-xl font-semibold">Browse by Category</h2>
				<div className="flex flex-wrap gap-2">
					{["Fun Run", "5K", "10K", "Half Marathon", "Full Marathon"].map(
						(cat) => (
							<Badge key={cat} variant="outline" className="px-3 py-1.5">
								{cat}
							</Badge>
						),
					)}
				</div>
			</section>
			{loginDialog}
		</div>
	);
}

function getSafeRedirect(redirect: string | undefined) {
	if (!redirect?.startsWith("/") || redirect.startsWith("//")) {
		return undefined;
	}
	return redirect;
}

function EventCardPlaceholder() {
	return (
		<div className="feature-card space-y-3 rounded-xl border border-border p-4">
			<div className="aspect-video rounded-lg bg-muted" />
			<div className="space-y-1.5">
				<div className="h-3 w-20 rounded bg-muted" />
				<div className="h-5 w-3/4 rounded bg-muted" />
				<div className="h-3 w-1/2 rounded bg-muted" />
			</div>
			<div className="flex items-center justify-between pt-1">
				<div className="h-4 w-24 rounded bg-muted" />
				<div className="h-4 w-16 rounded bg-muted" />
			</div>
		</div>
	);
}
