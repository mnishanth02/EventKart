import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import {
	createFileRoute,
	redirect,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { useRequireAuth } from "#/features/auth/hooks";
import { setPublicEventCacheHeaders } from "#/features/event-detail/cache-headers";
import { EventsListPagination } from "#/features/events-discovery/components/events-list-pagination";
import { EventsListSortSelect } from "#/features/events-discovery/components/events-list-sort-select";
import { PublicEventsList } from "#/features/events-discovery/components/public-events-list";
import { resolvePublicEventsListLoader } from "#/features/events-discovery/loader";
import {
	PUBLIC_EVENTS_LIST_DEFAULT_PAGE,
	PUBLIC_EVENTS_LIST_DEFAULT_SORT,
	PUBLIC_EVENTS_LIST_LIMIT,
	publicEventsListSearchSchema,
} from "#/features/events-discovery/search-params";

const searchSchema = z
	.object({
		reason: z.enum(["auth-required", "forbidden"]).optional().catch(undefined),
		redirect: z.string().optional().catch(undefined),
	})
	.extend(publicEventsListSearchSchema.shape);

export const Route = createFileRoute("/_public/")({
	component: Home,
	loaderDeps: ({ search }) => ({ page: search.page, sort: search.sort }),
	loader: async ({ context, deps }) => {
		const result = await resolvePublicEventsListLoader({
			queryClient: context.queryClient,
			setResponseHeaders: setPublicEventCacheHeaders,
			params: {
				page: deps.page,
				limit: PUBLIC_EVENTS_LIST_LIMIT,
				sort: deps.sort,
			},
		});
		if (result.meta.totalPages > 0 && deps.page > result.meta.totalPages) {
			throw redirect({
				to: "/",
				search: (prev) => ({ ...prev, page: result.meta.totalPages }),
			});
		}
		return result;
	},
	search: {
		middlewares: [
			stripSearchParams({
				page: PUBLIC_EVENTS_LIST_DEFAULT_PAGE,
				sort: PUBLIC_EVENTS_LIST_DEFAULT_SORT,
			}),
		],
	},
	validateSearch: searchSchema,
});

function Home() {
	const { page, reason, redirect, sort } = Route.useSearch();
	const { events, meta } = Route.useLoaderData();
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
			{reason === "auth-required" && safeRedirect ? (
				<div className="mb-8 rounded-xl border border-border bg-card p-4 text-center shadow-xs">
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

			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Showing page {page}
					</p>
				</div>
				<EventsListSortSelect
					value={sort}
					onChange={(next) =>
						void navigate({
							to: "/",
							search: (prev) => ({
								...prev,
								sort: next,
								page: PUBLIC_EVENTS_LIST_DEFAULT_PAGE,
							}),
						})
					}
				/>
			</div>
			<PublicEventsList events={events} meta={meta} />
			<div className="mt-8">
				<EventsListPagination
					meta={meta}
					buildPageHref={(nextPage) => ({
						to: "/",
						search: (prev) => ({ ...prev, page: nextPage }),
					})}
				/>
			</div>
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
