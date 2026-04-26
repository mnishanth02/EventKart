import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EventCategoryConfigForm } from "#/features/events/components/event-category-config-form";
import { eventCategoriesQueryOptions } from "#/features/events/queries";

export const Route = createFileRoute(
	"/_authed/org/events/$eventId/configure-categories",
)({
	component: ConfigureEventCategoriesPage,
	ssr: "data-only",
});

function ConfigureEventCategoriesPage() {
	const { eventId } = Route.useParams();
	const categoriesQuery = useQuery(eventCategoriesQueryOptions(eventId));

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">Configure Categories</h1>
					<p className="text-muted-foreground">
						Set the distance options for this event before publishing.
					</p>
				</div>
				<Button asChild variant="outline">
					<Link to="/org">Back to dashboard</Link>
				</Button>
			</div>

			{categoriesQuery.isLoading ? (
				<Card>
					<CardHeader>
						<CardTitle>Loading categories...</CardTitle>
						<CardDescription>
							Fetching the current event category configuration.
						</CardDescription>
					</CardHeader>
				</Card>
			) : null}

			{categoriesQuery.isError ? (
				<Alert variant="destructive">
					<AlertTitle>Could not load categories</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>
							Refresh the page or try again. The category API is expected at GET
							/api/v1/events/:eventId/categories.
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => categoriesQuery.refetch()}
						>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			) : null}

			{categoriesQuery.data ? (
				<EventCategoryConfigForm
					eventId={eventId}
					initialCategories={categoriesQuery.data}
				/>
			) : null}

			{categoriesQuery.data && categoriesQuery.data.length > 0 ? (
				<Card className="border-dashed">
					<CardHeader>
						<CardTitle>Next: configure pricing</CardTitle>
						<CardDescription>
							Set base prices and optional early-bird discounts for each saved
							distance category.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link
								to="/org/events/$eventId/configure-pricing"
								params={{ eventId }}
							>
								Configure pricing
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : null}

			{categoriesQuery.data?.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="py-4">
						<p className="text-muted-foreground text-sm">
							This event does not have saved categories yet. The form above uses
							the default 5K, 10K, and Half Marathon setup.
						</p>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
