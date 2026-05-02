import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	organizerProfileQueryOptions,
	policyStatusQueryOptions,
} from "#/features/organizer/queries";

type HeadingLevel = 1 | 2;

interface OrganizerSetupGateProps {
	children: ReactNode;
	headingLevel?: HeadingLevel;
}

export function OrganizerSetupGate({
	children,
	headingLevel = 1,
}: OrganizerSetupGateProps) {
	const profileQuery = useQuery(organizerProfileQueryOptions());
	const policyQuery = useQuery({
		...policyStatusQueryOptions(),
		enabled: profileQuery.data != null,
	});

	if (profileQuery.isLoading) {
		return <LoadingProfile />;
	}

	if (profileQuery.isError) {
		return (
			<ProfileLoadErrorCard
				headingLevel={headingLevel}
				onRetry={() => profileQuery.refetch()}
			/>
		);
	}

	if (!profileQuery.data) {
		return <CompleteProfileCta headingLevel={headingLevel} />;
	}

	if (policyQuery.isLoading) {
		return <CheckingPolicies />;
	}

	if (policyQuery.isError) {
		return (
			<PolicyLoadErrorCard
				headingLevel={headingLevel}
				onRetry={() => policyQuery.refetch()}
			/>
		);
	}

	if (policyQuery.data?.allRequiredAccepted !== true) {
		return <AcceptPoliciesCta headingLevel={headingLevel} />;
	}

	return <>{children}</>;
}

function LoadingProfile() {
	return (
		<div className="flex items-center justify-center py-12">
			<p className="text-muted-foreground">Loading profile...</p>
		</div>
	);
}

function ProfileLoadErrorCard({
	headingLevel,
	onRetry,
}: {
	headingLevel: HeadingLevel;
	onRetry: () => void;
}) {
	return (
		<div className="flex items-center justify-center py-12">
			<Card className="max-w-md text-center">
				<CardHeader>
					<CardTitle role="heading" aria-level={headingLevel}>
						Something Went Wrong
					</CardTitle>
					<CardDescription>
						We couldn&apos;t load your organizer profile. Please try again.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={onRetry}>Retry</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function CompleteProfileCta({ headingLevel }: { headingLevel: HeadingLevel }) {
	return (
		<div className="flex items-center justify-center py-12">
			<Card className="max-w-md text-center">
				<CardHeader>
					<CardTitle role="heading" aria-level={headingLevel}>
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

function CheckingPolicies() {
	return (
		<div className="flex items-center justify-center py-12">
			<p className="text-muted-foreground">Checking policy status...</p>
		</div>
	);
}

function PolicyLoadErrorCard({
	headingLevel,
	onRetry,
}: {
	headingLevel: HeadingLevel;
	onRetry: () => void;
}) {
	return (
		<div className="flex items-center justify-center py-12">
			<Card className="max-w-md text-center">
				<CardHeader>
					<CardTitle role="heading" aria-level={headingLevel}>
						Something Went Wrong
					</CardTitle>
					<CardDescription>
						We couldn&apos;t check your policy status. Please try again.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={onRetry}>Retry</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function AcceptPoliciesCta({ headingLevel }: { headingLevel: HeadingLevel }) {
	return (
		<div className="flex items-center justify-center py-12">
			<Card className="max-w-md text-center">
				<CardHeader>
					<CardTitle role="heading" aria-level={headingLevel}>
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
