import { hasMinimumRole } from "@repo/shared/constants/roles";
import { emailSchema } from "@repo/shared/schemas";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { OrganizerRegistrationForm } from "#/features/organizer/components/organizer-registration-form";
import { organizerProfileQueryOptions } from "#/features/organizer/queries";
import { ApiClientError, apiClient } from "#/lib/api-client";

export const Route = createFileRoute("/_authed/org/register")({
	component: OrganizerRegisterPage,
});

type EmailVerificationResponse = {
	success: true;
	data: {
		message: string;
		expiresInSeconds: number;
	};
};

function OrganizerRegisterPage() {
	const { user } = Route.useRouteContext();

	if (!hasMinimumRole(user.role, "organizer")) {
		return <OrganizerEmailVerificationGate />;
	}

	return <OrganizerRegistrationStep />;
}

function OrganizerRegistrationStep() {
	const profileQuery = useQuery(organizerProfileQueryOptions());

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
							We couldn&apos;t confirm whether you already have an organizer
							profile. Please try again.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={() => profileQuery.refetch()}>Retry</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (profileQuery.data) {
		return (
			<div className="flex items-center justify-center py-12">
				<Card className="max-w-md text-center">
					<CardHeader>
						<CardTitle>Organizer Profile Already Created</CardTitle>
						<CardDescription>
							Continue your verification journey or update your organizer
							details from the profile page.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
						<Button asChild>
							<Link to="/org">Go to Dashboard</Link>
						</Button>
						<Button asChild variant="outline">
							<Link to="/org/profile">Edit Profile</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Complete Your Profile</h1>
				<p className="text-muted-foreground">
					Set up your organizer profile to start creating and managing events.
				</p>
			</div>
			<OrganizerRegistrationForm />
		</div>
	);
}

function OrganizerEmailVerificationGate() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");

	const mutation = useMutation({
		mutationFn: (verifiedEmail: string) =>
			apiClient<EmailVerificationResponse>("/auth/email/send-verification", {
				method: "POST",
				body: { email: verifiedEmail },
			}),
		onSuccess: () => {
			toast.success("Verification email sent. Check your inbox to continue.");
		},
		onError: (err: unknown) => {
			const message =
				err instanceof ApiClientError || err instanceof Error
					? err.message
					: "Failed to send verification email. Please try again.";
			setError(message);
			toast.error(message);
		},
	});

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = emailSchema.safeParse(email);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Invalid email address");
			return;
		}
		setError("");
		mutation.mutate(parsed.data);
	}

	return (
		<div className="flex justify-center py-8">
			<Card className="max-w-lg">
				<CardHeader>
					<CardTitle>Verify your organizer email</CardTitle>
					<CardDescription>
						Organizer profiles require a verified email address before business
						details can be submitted.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{mutation.isSuccess ? (
						<div className="space-y-3 text-sm">
							<p className="text-muted-foreground">
								We sent a verification link to {email}. Open that link in this
								browser to unlock organizer registration.
							</p>
							<Button
								type="button"
								variant="outline"
								onClick={() => mutation.reset()}
							>
								Use a different email
							</Button>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="organizer-email">Email address</Label>
								<Input
									id="organizer-email"
									type="email"
									value={email}
									onChange={(event) => {
										setEmail(event.target.value);
										setError("");
									}}
									placeholder="you@example.com"
									disabled={mutation.isPending}
								/>
								{error ? (
									<p className="text-sm text-destructive" role="alert">
										{error}
									</p>
								) : null}
							</div>
							<Button type="submit" disabled={mutation.isPending}>
								{mutation.isPending
									? "Sending verification..."
									: "Send Verification Email"}
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
