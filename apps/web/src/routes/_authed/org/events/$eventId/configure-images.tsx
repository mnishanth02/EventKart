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
import { EventImageConfigForm } from "#/features/events/components/event-image-config-form";
import { eventImagesQueryOptions } from "#/features/events/queries";

export const Route = createFileRoute(
	"/_authed/org/events/$eventId/configure-images",
)({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(
			eventImagesQueryOptions(params.eventId),
		),
	component: ConfigureEventImagesPage,
	ssr: "data-only",
});

function ConfigureEventImagesPage() {
	const { eventId } = Route.useParams();
	const imagesQuery = useQuery(eventImagesQueryOptions(eventId));

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">Configure Images</h1>
					<p className="text-muted-foreground">
						Upload the hero image and route map for this event.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline">
						<Link
							to="/org/events/$eventId/configure-registration-fields"
							params={{ eventId }}
						>
							Back to registration fields
						</Link>
					</Button>
					<Button asChild variant="outline">
						<Link to="/org">Back to dashboard</Link>
					</Button>
				</div>
			</div>

			{imagesQuery.isLoading ? (
				<Card>
					<CardHeader>
						<CardTitle>Loading images...</CardTitle>
						<CardDescription>
							Fetching the current event image configuration.
						</CardDescription>
					</CardHeader>
				</Card>
			) : null}

			{imagesQuery.isError ? (
				<Alert variant="destructive">
					<AlertTitle>Could not load images</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>
							Refresh the page or try again. The image API is expected at GET
							/api/v1/events/:eventId/images.
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => imagesQuery.refetch()}
						>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			) : null}

			{imagesQuery.data ? (
				<EventImageConfigForm eventId={eventId} images={imagesQuery.data} />
			) : null}

			<Card className="border-dashed">
				<CardHeader>
					<CardTitle>Ready for review</CardTitle>
					<CardDescription>
						After categories, pricing, policies, registration fields, and images
						are configured, you can return to the organizer dashboard.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild>
						<Link to="/org">Finish configuration</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
