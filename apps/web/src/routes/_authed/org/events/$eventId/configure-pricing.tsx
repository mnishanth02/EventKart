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
import { EventPricingConfigForm } from "#/features/events/components/event-pricing-config-form";
import {
	eventCategoriesQueryOptions,
	eventPricingQueryOptions,
} from "#/features/events/queries";

export const Route = createFileRoute(
	"/_authed/org/events/$eventId/configure-pricing",
)({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				eventCategoriesQueryOptions(params.eventId),
			),
			context.queryClient.ensureQueryData(
				eventPricingQueryOptions(params.eventId),
			),
		]),
	component: ConfigureEventPricingPage,
	ssr: "data-only",
});

function ConfigureEventPricingPage() {
	const { eventId } = Route.useParams();
	const categoriesQuery = useQuery(eventCategoriesQueryOptions(eventId));
	const pricingQuery = useQuery(eventPricingQueryOptions(eventId));
	const isLoading = categoriesQuery.isLoading || pricingQuery.isLoading;
	const isError = categoriesQuery.isError || pricingQuery.isError;

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">Configure Pricing</h1>
					<p className="text-muted-foreground">
						Set category base prices and optional early-bird discounts.
					</p>
				</div>
				<Button asChild variant="outline">
					<Link to="/org">Back to dashboard</Link>
				</Button>
			</div>

			{isLoading ? (
				<Card>
					<CardHeader>
						<CardTitle>Loading pricing...</CardTitle>
						<CardDescription>
							Fetching categories and current event pricing tiers.
						</CardDescription>
					</CardHeader>
				</Card>
			) : null}

			{isError ? (
				<Alert variant="destructive">
					<AlertTitle>Could not load pricing</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>
							Refresh the page or try again. The pricing API is expected at GET
							/api/v1/events/:eventId/pricing.
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								void categoriesQuery.refetch();
								void pricingQuery.refetch();
							}}
						>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			) : null}

			{categoriesQuery.data && pricingQuery.data ? (
				<EventPricingConfigForm
					eventId={eventId}
					categories={categoriesQuery.data}
					initialPricingTiers={pricingQuery.data}
				/>
			) : null}

			{categoriesQuery.data && categoriesQuery.data.length > 0 ? (
				<Card className="border-dashed">
					<CardHeader>
						<CardTitle>Next: configure policies</CardTitle>
						<CardDescription>
							Add refund and cancellation terms participants can review before
							registration.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link
								to="/org/events/$eventId/configure-policies"
								params={{ eventId }}
							>
								Configure policies
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
