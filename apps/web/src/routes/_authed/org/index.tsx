import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { organizerProfileQueryOptions } from "#/features/organizer/queries";

export const Route = createFileRoute("/_authed/org/")({
	component: OrganizerDashboard,
});

function OrganizerDashboard() {
	const profileQuery = useQuery(organizerProfileQueryOptions());

	if (profileQuery.isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-muted-foreground">Loading profile...</p>
			</div>
		);
	}

	if (!profileQuery.data) {
		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle>Complete Your Profile</CardTitle>
						<CardDescription>
							You need to create an organizer profile before you can manage
							events.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link to="/org/register">Create Organizer Profile</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-bold">Organizer Dashboard</h1>
			<p className="text-muted-foreground">
				Welcome back, {profileQuery.data.businessName}! Event management,
				participants, and analytics will appear here.
			</p>
		</div>
	);
}
