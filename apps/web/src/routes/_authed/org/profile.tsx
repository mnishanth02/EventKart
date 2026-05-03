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
import { DeleteOrganizerSection } from "#/features/organizer/components/delete-organizer-section";
import { OrganizerProfileForm } from "#/features/organizer/components/organizer-profile-form";
import { organizerProfileQueryOptions } from "#/features/organizer/queries";

export const Route = createFileRoute("/_authed/org/profile")({
	component: ProfilePage,
});

function ProfilePage() {
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
						<CardTitle>No Organizer Profile</CardTitle>
						<CardDescription>
							You need to create an organizer profile before you can edit it.
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
		<div className="mx-auto max-w-2xl space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Organizer Profile</h1>
				<p className="text-muted-foreground">
					Manage your organizer profile information.
				</p>
			</div>
			<OrganizerProfileForm profile={profileQuery.data} />
			<DeleteOrganizerSection />
		</div>
	);
}
