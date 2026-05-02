import type { VerificationStatus } from "@repo/shared/constants";
import { VERIFICATION_STATUS_LABELS } from "@repo/shared/constants";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Progress } from "@repo/ui/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	organizerProfileQueryOptions,
	policyStatusQueryOptions,
	verificationStatusQueryOptions,
} from "#/features/organizer/queries";

export const Route = createFileRoute("/_authed/org/")({
	component: OrganizerDashboard,
});

function getVerificationBadgeVariant(
	status: VerificationStatus,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "approved":
			return "default";
		case "pending_review":
			return "secondary";
		case "rejected":
			return "destructive";
		default:
			return "outline";
	}
}

function VerificationStatusCard() {
	const { data, isLoading } = useQuery(verificationStatusQueryOptions());

	if (isLoading) {
		return (
			<Card>
				<CardContent className="py-4">
					<p className="text-muted-foreground text-sm">
						Loading verification status...
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!data) return null;

	const status = data.verificationStatus as VerificationStatus;
	const { uploadedCount, total } = data.steps.documents;
	const progressPercent = total > 0 ? (uploadedCount / total) * 100 : 0;

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">Verification Status</CardTitle>
					<Badge variant={getVerificationBadgeVariant(status)}>
						{VERIFICATION_STATUS_LABELS[status] ?? status}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{status === "pending_documents" ? (
					<>
						<p className="text-sm text-muted-foreground">
							Upload your verification documents to continue.
						</p>
						<div className="space-y-1">
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>Documents</span>
								<span>
									{String(uploadedCount)}/{String(total)} uploaded
								</span>
							</div>
							<Progress value={progressPercent} className="h-2" />
						</div>
						<Button asChild size="sm">
							<Link to="/org/verification">Upload Documents</Link>
						</Button>
					</>
				) : null}

				{status === "pending_review" ? (
					<>
						<p className="text-sm text-muted-foreground">
							Your application is under review.
							{data.expectedReviewBy
								? ` Expected review by ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(data.expectedReviewBy))}.`
								: ""}
						</p>
						<div className="space-y-1">
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>Documents</span>
								<span>
									{String(uploadedCount)}/{String(total)} uploaded
								</span>
							</div>
							<Progress value={progressPercent} className="h-2" />
						</div>
					</>
				) : null}

				{status === "approved" ? (
					<p className="text-sm text-green-700 dark:text-green-400">
						✓ Verified — You can create and publish events.
					</p>
				) : null}

				{status === "rejected" ? (
					<>
						<p className="text-sm text-destructive">
							Action Required: Your verification was not approved.
						</p>
						{data.rejectionReason ? (
							<p className="text-xs text-muted-foreground">
								{data.rejectionReason}
							</p>
						) : null}
						<Button asChild size="sm" variant="destructive">
							<Link to="/org/verification">Review & Resubmit</Link>
						</Button>
					</>
				) : null}
			</CardContent>
		</Card>
	);
}

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

	if (profileQuery.isError) {
		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle role="heading" aria-level={1}>
							Something Went Wrong
						</CardTitle>
						<CardDescription>
							We couldn&apos;t load your organizer profile. Please try again.
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
						<CardTitle role="heading" aria-level={1}>
							Complete Your Profile
						</CardTitle>
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
		policyQuery.isError ||
		(policyQuery.data != null && !policyQuery.data.allRequiredAccepted)
	) {
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
						<CardTitle role="heading" aria-level={1}>
							Something Went Wrong
						</CardTitle>
							<CardDescription>
								We couldn&apos;t check your policy status. Please try again.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button onClick={() => policyQuery.refetch()}>Retry</Button>
						</CardContent>
					</Card>
				</div>
			);
		}

		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle role="heading" aria-level={1}>
							Accept Platform Policies
						</CardTitle>
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
			<VerificationStatusCard />
			<div className="flex gap-3">
				<Button asChild>
					<Link to="/org/events/new">Create Event</Link>
				</Button>
				<Button asChild variant="outline">
					<Link to="/org/profile">Edit Profile</Link>
				</Button>
				<Button asChild variant="outline">
					<Link to="/org/verification">Verification</Link>
				</Button>
			</div>
		</div>
	);
}
