import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/my/")({
	component: ParticipantDashboard,
});

function ParticipantDashboard() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-bold">My Dashboard</h1>
			<p className="text-muted-foreground">
				Your bookings, profile, and race history will appear here.
			</p>
		</div>
	);
}
