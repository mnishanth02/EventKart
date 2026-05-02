import type { VerificationStatus } from "@repo/shared/constants";
import { VERIFICATION_STATUS_LABELS } from "@repo/shared/constants";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Progress } from "@repo/ui/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { OrganizerSetupGate } from "#/features/organizer/components/organizer-setup-gate";
import {
	organizerProfileQueryOptions,
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
	return (
		<OrganizerSetupGate>
			<OrganizerDashboardContent />
		</OrganizerSetupGate>
	);
}

function OrganizerDashboardContent() {
	const profileQuery = useQuery(organizerProfileQueryOptions());

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-bold">Organizer Dashboard</h1>
			<p className="text-muted-foreground">
				Welcome back, {profileQuery.data?.businessName}! Event management,
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
