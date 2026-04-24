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
import {
	organizerProfileQueryOptions,
	policyStatusQueryOptions,
} from "#/features/organizer/queries";

export const Route = createFileRoute("/_authed/org/")({
	component: OrganizerDashboard,
});

function OrganizerDashboard() {
	const profileQuery = useQuery(organizerProfileQueryOptions());
	const policyQuery = useQuery({
		...policyStatusQueryOptions(),
		enabled: profileQuery.data != null,
	});

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

	if (
		policyQuery.isLoading ||
		(policyQuery.data != null && !policyQuery.data.allRequiredAccepted)
	) {
		if (policyQuery.isLoading) {
			return (
				<div className="flex items-center justify-center py-12">
					<p className="text-muted-foreground">Checking policy status...</p>
				</div>
			);
		}

		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle>Accept Platform Policies</CardTitle>
						<CardDescription>
							You need to accept our platform policies before you can manage
							events.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link to="/org/policies">Review & Accept Policies</Link>
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
