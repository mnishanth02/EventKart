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
		<div className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16 lg:px-8">
			{ reason === "auth-required" && safeRedirect ? (
				<div className="mb-8 rounded-xl border border-border bg-card p-4 text-center shadow-xs">
					<p className="text-sm text-muted-foreground">
						Sign in to continue to your requested page.
					</p>
					<div className="mt-3 flex justify-center gap-2">
						<Button type="button" onClick={ handleSignInRedirect }>
							Sign In & Continue
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={ () => void navigate({ to: "/", replace: true }) }
						>
							Stay Here
						</Button>
					</div>
				</div>
			) : null }

			{/* Hero section */ }
			<section className="space-y-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
				<Badge variant="secondary" className="text-xs font-semibold">
					Coimbatore&apos;s Running Community
				</Badge>
				<h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
					Find your next race
				</h1>
				<p className="mx-auto max-w-lg text-base text-muted-foreground md:text-lg">
					Discover running events, register in seconds, and show up ready to
					run.
				</p>
			</section>

			<Separator className="my-12 md:my-16" />

			{/* Placeholder sections — to be replaced with real event discovery */ }
			<section className="space-y-6">
				<h2 className="font-display text-xl font-semibold">
					This Weekend in Coimbatore
				</h2>
				<div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
					<p className="text-sm text-muted-foreground">
						No events scheduled this weekend — check back soon!
					</p>
				</div>
			</section>

			<section className="mt-12 space-y-6 md:mt-16">
				<h2 className="font-display text-xl font-semibold">
					Browse by Category
				</h2>
				<div className="flex flex-wrap gap-2">
					{ ["Fun Run", "5K", "10K", "Half Marathon", "Full Marathon"].map(
						(cat) => (
							<Badge key={ cat } variant="outline" className="px-3 py-1.5">
								{ cat }
							</Badge>
						),
					) }
				</div>
			</section>
			{ loginDialog }
		</div>
	);
}

function getSafeRedirect(redirect: string | undefined) {
	if (!redirect?.startsWith("/") || redirect.startsWith("//")) {
		return undefined;
	}
	return redirect;
}
