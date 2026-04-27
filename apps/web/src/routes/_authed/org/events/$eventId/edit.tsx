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
import { EventStatusBadge } from "#/features/events/components/event-status-badge";
import { EventEditForm } from "#/features/events/components/event-edit-form";
import { PublishAction } from "#/features/events/components/publish-action";
import { PublishChecklist } from "#/features/events/components/publish-checklist";
import { UnpublishAction } from "#/features/events/components/unpublish-action";
import {
	eventQueryOptions,
	publishReadinessQueryOptions,
} from "#/features/events/queries";

export const Route = createFileRoute("/_authed/org/events/$eventId/edit")({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(eventQueryOptions(params.eventId)),
	component: EditEventPage,
	pendingComponent: EditEventPending,
	errorComponent: EditEventError,
	ssr: "data-only",
});

function EditEventPending() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Loading event...</CardTitle>
				<CardDescription>Fetching the current event details.</CardDescription>
			</CardHeader>
		</Card>
	);
}

function EditEventError() {
	const { eventId } = Route.useParams();

	return (
		<Alert variant="destructive">
			<AlertTitle>Could not load event</AlertTitle>
			<AlertDescription className="space-y-3">
				<p>
					Refresh the page or try again. The event API is expected at GET
					/api/v1/events/:eventId.
				</p>
				<Button asChild type="button" variant="outline" size="sm">
					<Link to="/org/events/$eventId/edit" params={{ eventId }}>
						Retry
					</Link>
				</Button>
			</AlertDescription>
		</Alert>
	);
}

function ConfigurationNav({ eventId }: { eventId: string }) {
	const links = [
		{
			to: "/org/events/$eventId/configure-categories",
			label: "Categories",
		},
		{
			to: "/org/events/$eventId/configure-pricing",
			label: "Pricing",
		},
		{
			to: "/org/events/$eventId/configure-policies",
			label: "Policies",
		},
		{
			to: "/org/events/$eventId/configure-images",
			label: "Images",
		},
	] as const;

	return (
		<Card className="border-dashed">
			<CardHeader>
				<CardTitle>Pre-event configuration</CardTitle>
				<CardDescription>
					Continue editing the launch surfaces for this event.
				</CardDescription>
			</CardHeader>
			<div className="flex flex-wrap gap-2 px-6 pb-6">
				{links.map((link) => (
					<Button key={link.label} asChild variant="outline" size="sm">
						<Link to={link.to} params={{ eventId }}>
							{link.label}
						</Link>
					</Button>
				))}
			</div>
		</Card>
	);
}

function EditEventPage() {
	const { eventId } = Route.useParams();
	const eventQuery = useQuery(eventQueryOptions(eventId));
	const readinessQuery = useQuery({
		...publishReadinessQueryOptions(eventId),
		enabled: eventQuery.data?.status === "draft",
	});
	const event = eventQuery.data;

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-bold">Edit Event</h1>
						{event ? <EventStatusBadge status={event.status} /> : null}
					</div>
					<p className="text-muted-foreground">
						Update core event details before publishing.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline">
						<Link to="/org">Back to dashboard</Link>
					</Button>
					<Button asChild>
						<Link
							to="/org/events/$eventId/configure-categories"
							params={{ eventId }}
						>
							Configure event
						</Link>
					</Button>
				</div>
			</div>

			{eventQuery.isLoading ? <EditEventPending /> : null}

			{eventQuery.isError ? (
				<Alert variant="destructive">
					<AlertTitle>Could not load event</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>Refresh the page or try again.</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => eventQuery.refetch()}
						>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			) : null}

			{event ? (
				<Card>
					<CardHeader>
						<CardTitle>Publishing</CardTitle>
						<CardDescription>
							Review readiness and manage this event's public visibility.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{event.status === "draft" ? (
							<>
								{readinessQuery.isLoading ? (
									<p className="text-muted-foreground text-sm">
										Checking publish readiness...
									</p>
								) : null}
								{readinessQuery.isError ? (
									<Alert variant="destructive">
										<AlertTitle>Could not load publish readiness</AlertTitle>
										<AlertDescription>
											Refresh the page or try again before publishing.
										</AlertDescription>
									</Alert>
								) : null}
								{readinessQuery.data ? (
									<>
										<PublishChecklist readiness={readinessQuery.data} />
										<PublishAction
											eventId={eventId}
											ready={readinessQuery.data.ready}
											disabledReason="Complete all required checklist items before publishing."
										/>
									</>
								) : null}
							</>
						) : null}
						{event.status === "under_review" ? (
							<Alert>
								<AlertTitle>Pending admin review</AlertTitle>
								<AlertDescription>
									This event is submitted for review and is not publicly visible
									yet.
								</AlertDescription>
							</Alert>
						) : null}
						{event.status === "published" ? (
							<UnpublishAction eventId={eventId} />
						) : null}
					</CardContent>
				</Card>
			) : null}

			{event ? <EventEditForm event={event} /> : null}

			<ConfigurationNav eventId={eventId} />
		</div>
	);
}
