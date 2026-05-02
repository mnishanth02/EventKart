import { createFileRoute } from "@tanstack/react-router";
import { EventCreateForm } from "#/features/events/components/event-create-form";
import { OrganizerSetupGate } from "#/features/organizer/components/organizer-setup-gate";

export const Route = createFileRoute("/_authed/org/events/new")({
	component: NewEventPage,
	ssr: "data-only",
});

export function NewEventPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Create Event</h1>
				<p className="text-muted-foreground">
					Create a V1 paid single-day running event.
				</p>
			</div>
			<OrganizerSetupGate headingLevel={2}>
				<EventCreateForm />
			</OrganizerSetupGate>
		</div>
	);
}
