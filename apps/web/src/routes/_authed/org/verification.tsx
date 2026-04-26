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
import { VerificationDocuments } from "#/features/organizer/components/verification-documents";
import { VerificationStatusTracker } from "#/features/organizer/components/verification-status-tracker";
import {
	organizerProfileQueryOptions,
	policyStatusQueryOptions,
} from "#/features/organizer/queries";

export const Route = createFileRoute("/_authed/org/verification")({
	component: VerificationPage,
});

function VerificationPage() {
	const profileQuery = useQuery(organizerProfileQueryOptions());
	const policyQuery = useQuery({
		...policyStatusQueryOptions(),
		enabled: profileQuery.data != null,
	});

	if (profileQuery.isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-muted-foreground">Checking organizer profile...</p>
			</div>
		);
	}

	if (profileQuery.isError) {
		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle>Unable to Load Profile</CardTitle>
						<CardDescription>
							We couldn&apos;t confirm your organizer profile. Please try again.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={() => profileQuery.refetch()}>Retry</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!profileQuery.data) {
		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle>Create Your Organizer Profile First</CardTitle>
						<CardDescription>
							Verification documents can be uploaded after your organizer
							profile is created.
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

	if (policyQuery.isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-muted-foreground">Checking policy status...</p>
			</div>
		);
	}

	if (policyQuery.isError) {
		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle>Unable to Load Policies</CardTitle>
						<CardDescription>
							We couldn&apos;t confirm your policy acceptance status. Please try
							again.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={() => policyQuery.refetch()}>Retry</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (policyQuery.data?.allRequiredAccepted !== true) {
		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle>Accept Platform Policies First</CardTitle>
						<CardDescription>
							Review and accept the required organizer policies before uploading
							verification documents.
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
		<div className="mx-auto max-w-3xl space-y-6">
			<h1 className="text-2xl font-bold">Organizer Verification</h1>
			<VerificationStatusTracker />
			<VerificationDocuments />
		</div>
	);
}
