import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { useAuth, useAuthActions, useRequireAuth } from "#/features/auth/hooks";
import { ApiClientError, apiClient } from "#/lib/api-client";
import { toastRetry } from "@/components/design-system";

const tokenSchema = z
	.string()
	.length(64)
	.regex(/^[a-f0-9]{64}$/);

const searchSchema = z.object({
	token: tokenSchema.optional().catch(undefined),
});

type VerifyEmailResponse = {
	success: true;
	data: {
		role: string;
		email: string;
		message: string;
	};
};

export const Route = createFileRoute("/_public/auth/verify-email")({
	component: VerifyEmailPage,
	validateSearch: searchSchema,
});

function VerifyEmailPage() {
	const { token } = Route.useSearch();
	const navigate = useNavigate();
	const { isAuthenticated, isLoading } = useAuth();
	const { invalidateSession } = useAuthActions();
	const { requireAuth, loginDialog } = useRequireAuth();
	const attemptedRef = useRef(false);

	const mutation = useMutation({
		mutationFn: (verificationToken: string) =>
			apiClient<VerifyEmailResponse>("/auth/email/verify", {
				method: "POST",
				body: { token: verificationToken },
			}),
		onSuccess: () => {
			invalidateSession();
			toast.success("Email verified. Continue your organizer registration.");
			void navigate({ to: "/org/register" });
		},
		onError: (err: unknown) => {
			const message =
				err instanceof Error
					? err.message
					: "Verification failed. Please try again.";
			toastRetry(message, {
				onRetry: () => {
					if (token) mutation.mutate(token);
				},
			});
		},
	});

	useEffect(() => {
		if (!token || isLoading || !isAuthenticated || attemptedRef.current) return;
		attemptedRef.current = true;
		mutation.mutate(token);
	}, [isAuthenticated, isLoading, mutation, token]);

	function handleSignInAndVerify() {
		if (!token) return;
		requireAuth(() => {
			attemptedRef.current = true;
			mutation.mutate(token);
		});
	}

	function getErrorMessage() {
		const error = mutation.error;
		if (error instanceof ApiClientError || error instanceof Error) {
			return error.message;
		}
		return "We could not verify this email link. Please request a new one.";
	}

	if (!token) {
		return (
			<CenteredCard
				title="Invalid verification link"
				description="This organizer verification link is missing or malformed."
			>
				<Button asChild>
					<Link to="/org/register">Request a New Link</Link>
				</Button>
			</CenteredCard>
		);
	}

	if (!isLoading && !isAuthenticated) {
		return (
			<>
				<CenteredCard
					title="Sign in to verify your email"
					description="For your security, sign in with the phone number you used for EventKart before we apply this organizer email verification."
				>
					<Button type="button" onClick={ handleSignInAndVerify }>
						Sign In & Verify Email
					</Button>
				</CenteredCard>
				{ loginDialog }
			</>
		);
	}

	if (mutation.isError) {
		return (
			<CenteredCard title="Verification failed" description={ getErrorMessage() }>
				<Button asChild>
					<Link to="/org/register">Request a New Link</Link>
				</Button>
			</CenteredCard>
		);
	}

	return (
		<CenteredCard
			title="Verifying your email"
			description="Please wait while we unlock organizer registration."
		>
			<p className="text-sm text-muted-foreground">
				This usually takes a moment.
			</p>
		</CenteredCard>
	);
}

function CenteredCard({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mx-auto flex min-h-[50vh] w-full max-w-md items-center justify-center px-4 py-12">
			<Card className="w-full text-center">
				<CardHeader>
					<CardTitle role="heading" aria-level={ 1 }>
						{ title }
					</CardTitle>
					<CardDescription>{ description }</CardDescription>
				</CardHeader>
				<CardContent>{ children }</CardContent>
			</Card>
		</div>
	);
}
