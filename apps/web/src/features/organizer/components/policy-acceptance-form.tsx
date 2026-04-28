import type { OrganizerPolicyType } from "@repo/shared/constants";
import {
	ORGANIZER_POLICY_LABELS,
	REQUIRED_ORGANIZER_POLICIES,
} from "@repo/shared/constants";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ApiClientError } from "#/lib/api-client.shared";
import { toastRetry } from "@/components/design-system";
import { acceptOrganizerPolicies } from "../api";
import {
	POLICY_STATUS_QUERY_KEY,
	policyStatusQueryOptions,
	VERIFICATION_STATUS_QUERY_KEY,
} from "../queries";

const POLICY_DESCRIPTIONS: Record<OrganizerPolicyType, string> = {
	platform_terms:
		"By accepting these terms, you agree to comply with EventKart's platform policies including fair pricing, accurate event descriptions, timely communication with participants, and adherence to cancellation/refund policies.",
	refund_policy:
		"You acknowledge and agree to EventKart's refund policy framework which requires organizers to define clear refund and cancellation policies for each event, process approved refunds within 7 business days, and honor the policies displayed to participants at the time of booking.",
};

export function PolicyAcceptanceForm() {
	const queryClient = useQueryClient();
	const policyQuery = useQuery(policyStatusQueryOptions());

	const [checked, setChecked] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(REQUIRED_ORGANIZER_POLICIES.map((p) => [p, false])),
	);

	const mutation = useMutation({
		mutationFn: (policies: string[]) =>
			acceptOrganizerPolicies({ data: { policies } }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: POLICY_STATUS_QUERY_KEY,
			});
			void queryClient.invalidateQueries({
				queryKey: VERIFICATION_STATUS_QUERY_KEY,
			});
			toast.success("Policies accepted successfully!");
		},
		onError: (error: unknown) => {
			toastRetry(
				error instanceof ApiClientError
					? error.message
					: error instanceof Error
						? error.message
						: "Failed to accept policies. Please try again.",
				{ onRetry: handleAccept },
			);
		},
	});

	function handleAccept() {
		mutation.mutate([...REQUIRED_ORGANIZER_POLICIES]);
	}

	if (policyQuery.isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-muted-foreground" role="status" aria-live="polite">
					Loading policy status...
				</p>
			</div>
		);
	}

	if (policyQuery.isError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-2xl">Platform Policies</CardTitle>
					<CardDescription>
						Required organizer policy acceptance status could not be loaded.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-destructive" role="alert">
						Failed to load policy status. Please refresh the page and try again.
					</p>
					<Button
						type="button"
						className="mt-4"
						onClick={() => policyQuery.refetch()}
					>
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	const allAccepted = policyQuery.data?.allRequiredAccepted === true;
	const acceptedPolicyTypes = new Set(
		policyQuery.data?.policies
			.filter((policy) => policy.isCurrentVersionAccepted)
			.map((policy) => policy.policyType) ?? [],
	);
	const allReadyToAccept = REQUIRED_ORGANIZER_POLICIES.every(
		(policyType) => acceptedPolicyTypes.has(policyType) || checked[policyType],
	);

	if (allAccepted) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-2xl">Platform Policies</CardTitle>
					<CardDescription>
						All required policies have been accepted.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{policyQuery.data?.policies.map((item) => (
						<div
							key={item.policyType}
							className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
						>
							<div className="flex size-5 items-center justify-center rounded-full bg-green-500 text-white">
								<svg
									className="size-3"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<title>Accepted</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={3}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
							<div>
								<p className="font-medium">
									{ORGANIZER_POLICY_LABELS[
										item.policyType as OrganizerPolicyType
									] ?? item.policyType}
								</p>
								{item.acceptedAt ? (
									<p className="text-sm text-muted-foreground">
										Accepted on {new Date(item.acceptedAt).toLocaleDateString()}
									</p>
								) : null}
							</div>
						</div>
					))}
					<div className="flex flex-col gap-2 pt-2 sm:flex-row">
						<Button asChild>
							<Link to="/org/verification">Continue to Verification</Link>
						</Button>
						<Button asChild variant="outline">
							<Link to="/org">Back to Dashboard</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-2xl">Accept Platform Policies</CardTitle>
				<CardDescription>
					Please review and accept the following policies to continue as an
					organizer on EventKart.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{REQUIRED_ORGANIZER_POLICIES.map((policyType) => {
					const alreadyAccepted = policyQuery.data?.policies.find(
						(p) => p.policyType === policyType && p.isCurrentVersionAccepted,
					);

					return (
						<div key={policyType} className="space-y-3 rounded-lg border p-4">
							<h3 className="font-semibold">
								{ORGANIZER_POLICY_LABELS[policyType]}
							</h3>
							<p
								id={`policy-${policyType}-description`}
								className="text-sm text-muted-foreground"
							>
								{POLICY_DESCRIPTIONS[policyType]}
							</p>

							{alreadyAccepted ? (
								<p className="text-sm font-medium text-green-600 dark:text-green-400">
									✓ Accepted on{" "}
									{alreadyAccepted.acceptedAt
										? new Date(alreadyAccepted.acceptedAt).toLocaleDateString()
										: "—"}
								</p>
							) : (
								<div className="flex items-center gap-2">
									<Checkbox
										id={`policy-${policyType}`}
										checked={checked[policyType] ?? false}
										aria-describedby={`policy-${policyType}-description`}
										onCheckedChange={(value) =>
											setChecked((prev) => ({
												...prev,
												[policyType]: value === true,
											}))
										}
									/>
									<Label
										htmlFor={`policy-${policyType}`}
										className="text-sm font-normal"
									>
										I have read and accept the{" "}
										{ORGANIZER_POLICY_LABELS[policyType]}
									</Label>
								</div>
							)}
						</div>
					);
				})}

				<Button
					type="button"
					className="w-full"
					disabled={!allReadyToAccept || mutation.isPending}
					onClick={handleAccept}
				>
					{mutation.isPending ? "Accepting Policies..." : "Accept All Policies"}
				</Button>
			</CardContent>
		</Card>
	);
}
