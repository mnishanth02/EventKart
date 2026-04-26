import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

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
			<Card className="max-w-xl">
				<CardHeader>
					<CardTitle>Organizer Verification Queue</CardTitle>
					<CardDescription>
						Review submitted organizer profiles, documents, and policy status.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild>
						<Link to="/admin/verifications">Open Verification Queue</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
