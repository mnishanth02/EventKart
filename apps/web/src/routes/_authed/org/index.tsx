import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/org/")({
	component: OrganizerDashboard,
});

function OrganizerDashboard() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-bold">Organizer Dashboard</h1>
			<p className="text-muted-foreground">
				Event management, participants, and analytics will appear here.
			</p>
		</div>
	);
}
