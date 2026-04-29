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
import { EventPolicyConfigForm } from "#/features/events/components/event-policy-config-form";
import { eventPoliciesQueryOptions } from "#/features/events/queries";

export const Route = createFileRoute(
	"/_authed/org/events/$eventId/configure-policies",
)({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(
			eventPoliciesQueryOptions(params.eventId),
		),
	component: ConfigureEventPoliciesPage,
	ssr: "data-only",
});

function ConfigureEventPoliciesPage() {
	const { eventId } = Route.useParams();
	const policiesQuery = useQuery(eventPoliciesQueryOptions(eventId));

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">Configure Policies</h1>
					<p className="text-muted-foreground">
						Capture the refund and cancellation terms for this event.
					</p>
				</div>
				<Button asChild variant="outline">
					<Link to="/org">Back to dashboard</Link>
				</Button>
			</div>

			{policiesQuery.isLoading ? (
				<Card>
					<CardHeader>
						<CardTitle>Loading policies...</CardTitle>
						<CardDescription>
							Fetching the current refund and cancellation policies.
						</CardDescription>
					</CardHeader>
				</Card>
			) : null}

			{policiesQuery.isError ? (
				<Alert variant="destructive">
					<AlertTitle>Could not load policies</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>
							Refresh the page or try again. The policy API is expected at GET
							/api/v1/events/:eventId/policies.
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => policiesQuery.refetch()}
						>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			) : null}

			{policiesQuery.data ? (
				<EventPolicyConfigForm
					eventId={eventId}
					initialPolicies={policiesQuery.data}
				/>
			) : null}

			{policiesQuery.data ? (
				<Card className="border-dashed">
					<CardHeader>
						<CardTitle>Next: configure registration fields</CardTitle>
						<CardDescription>
							Choose standard and fitness-specific participant fields before
							image setup.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link
								to="/org/events/$eventId/configure-registration-fields"
								params={{ eventId }}
							>
								Configure registration fields
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
