import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/admin/")({
	component: AdminDashboard,
});

function AdminDashboard() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-bold">Admin Dashboard</h1>
			<p className="text-muted-foreground">
				Verifications, event reviews, and platform management will appear here.
			</p>
		</div>
	);
}
