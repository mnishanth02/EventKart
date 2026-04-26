import { createFileRoute } from "@tanstack/react-router";
import { EventCreateForm } from "#/features/events/components/event-create-form";

export const Route = createFileRoute("/_authed/org/events/new")({
	component: NewEventPage,
	ssr: "data-only",
});

function NewEventPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Create Event</h1>
				<p className="text-muted-foreground">
					Create a V1 paid single-day running event in Coimbatore.
				</p>
			</div>
			<EventCreateForm />
		</div>
	);
}
