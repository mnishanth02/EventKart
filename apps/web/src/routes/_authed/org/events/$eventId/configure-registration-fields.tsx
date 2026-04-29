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
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EventRegistrationFieldConfigForm } from "#/features/events/components/event-registration-field-config-form";
import { eventRegistrationFormQueryOptions } from "#/features/events/queries";

export const Route = createFileRoute(
	"/_authed/org/events/$eventId/configure-registration-fields",
)({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(
			eventRegistrationFormQueryOptions(params.eventId),
		),
	component: ConfigureEventRegistrationFieldsPage,
	errorComponent: ConfigureEventRegistrationFieldsError,
	pendingComponent: ConfigureEventRegistrationFieldsPending,
	ssr: "data-only",
});

function ConfigureEventRegistrationFieldsPending() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Loading registration fields...</CardTitle>
				<CardDescription>
					Fetching the current event registration form configuration.
				</CardDescription>
			</CardHeader>
		</Card>
	);
}

function ConfigureEventRegistrationFieldsError({ reset }: ErrorComponentProps) {
	return (
		<Alert variant="destructive">
			<AlertTitle>Could not load registration fields</AlertTitle>
			<AlertDescription className="space-y-3">
				<p>
					Refresh the page or try again. The registration form API is expected
					at GET /api/v1/events/:eventId/registration-form.
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => reset()}
				>
					Retry
				</Button>
			</AlertDescription>
		</Alert>
	);
}

function ConfigureEventRegistrationFieldsPage() {
	const { eventId } = Route.useParams();
	const registrationFormQuery = useQuery(
		eventRegistrationFormQueryOptions(eventId),
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">Configure Registration Fields</h1>
					<p className="text-muted-foreground">
						Choose the participant details collected during event registration.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline">
						<Link
							to="/org/events/$eventId/configure-policies"
							params={{ eventId }}
						>
							Back to policies
						</Link>
					</Button>
					<Button asChild variant="outline">
						<Link to="/org">Back to dashboard</Link>
					</Button>
				</div>
			</div>

			{registrationFormQuery.isLoading ? (
				<ConfigureEventRegistrationFieldsPending />
			) : null}

			{registrationFormQuery.isError ? (
				<Alert variant="destructive">
					<AlertTitle>Could not load registration fields</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>
							Refresh the page or try again. The registration form API is
							expected at GET /api/v1/events/:eventId/registration-form.
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => registrationFormQuery.refetch()}
						>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			) : null}

			{registrationFormQuery.data ? (
				<EventRegistrationFieldConfigForm
					eventId={eventId}
					initialRegistrationForm={registrationFormQuery.data}
				/>
			) : null}

			{registrationFormQuery.data ? (
				<Card className="border-dashed">
					<CardHeader>
						<CardTitle>Next: configure images</CardTitle>
						<CardDescription>
							Upload a hero image and route map after registration fields are
							saved.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link
								to="/org/events/$eventId/configure-images"
								params={{ eventId }}
							>
								Configure images
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
