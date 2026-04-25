import {
	VERIFICATION_DOCUMENT_TYPE_LABELS,
	VERIFICATION_DOCUMENT_TYPES,
	VERIFICATION_STATUS_LABELS,
	type VerificationDocumentType,
	type VerificationStatus,
} from "@repo/shared/constants";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { VerifiedBadge } from "@repo/ui/components/verified-badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle2,
	Clock,
	ExternalLink,
	FileText,
	Loader2,
	ShieldCheck,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getDocumentViewUrl } from "../api";
import {
	ADMIN_VERIFICATIONS_QUERY_KEY,
	adminVerificationDetailQueryOptions,
} from "../queries";
import { ReviewActionDialog } from "./review-action-dialog";

function formatDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateStr));
}

function getStatusBadgeVariant(
	status: string,
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

// ── Document Viewer Button ─────────────────────────────────────────

function ViewDocumentButton({
	organizerId,
	documentId,
}: {
	organizerId: string;
	documentId: string;
}) {
	const mutation = useMutation({
		mutationFn: async () => {
			return getDocumentViewUrl({ data: { organizerId, documentId } });
		},
		onSuccess: (data) => {
			window.open(data.url, "_blank", "noopener,noreferrer");
		},
		onError: () => {
			toast.error("Failed to get document URL");
		},
	});

	return (
		<Button
			variant="outline"
			size="sm"
			disabled={mutation.isPending}
			onClick={() => mutation.mutate()}
		>
			{mutation.isPending ? (
				<Loader2 className="mr-1 size-3 animate-spin" />
			) : (
				<ExternalLink className="mr-1 size-3" />
			)}
			View
		</Button>
	);
}

// ── Main Component ─────────────────────────────────────────────────

export function VerificationReviewDetail({
	organizerId,
}: {
	organizerId: string;
}) {
	const queryClient = useQueryClient();
	const [dialogState, setDialogState] = useState<{
		open: boolean;
		type: "approve" | "reject";
	}>({ open: false, type: "approve" });

	const { data, isLoading, isError } = useQuery(
		adminVerificationDetailQueryOptions(organizerId),
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
				<span className="ml-2 text-muted-foreground">Loading details...</span>
			</div>
		);
	}

	if (isError || !data) {
		return (
			<Alert variant="destructive">
				<XCircle className="size-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>
					Failed to load verification details. The organizer may not exist.
				</AlertDescription>
			</Alert>
		);
	}

	const { organizer, documents, policiesAccepted, policyDetails } = data;
	const status = organizer.verificationStatus as VerificationStatus;
	const isPendingReview = status === "pending_review";

	// Build map of uploaded documents by type
	const docsByType = new Map<string, (typeof documents)[number]>();
	for (const doc of documents) {
		docsByType.set(doc.documentType, doc);
	}

	function handleActionSuccess() {
		void queryClient.invalidateQueries({
			queryKey: [...ADMIN_VERIFICATIONS_QUERY_KEY, organizerId],
		});
	}

	return (
		<div className="space-y-6">
			{/* Back navigation + header */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="sm" asChild>
					<Link to="/admin/verifications">
						<ArrowLeft className="mr-1 size-4" />
						Back to Queue
					</Link>
				</Button>
			</div>

			<div className="flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-2 text-2xl font-bold">
						{organizer.businessName}
						{organizer.isVerified && <VerifiedBadge variant="inline" />}
					</h1>
					<p className="text-muted-foreground">
						Verification Review for organizer {organizerId}
					</p>
				</div>
				<Badge variant={getStatusBadgeVariant(status)} className="text-sm">
					{VERIFICATION_STATUS_LABELS[status] ?? status}
				</Badge>
			</div>

			{/* 1. Organizer Info */}
			<Card>
				<CardHeader>
					<CardTitle>Organizer Information</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-4 sm:grid-cols-2">
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Business Name
							</dt>
							<dd className="mt-1">{organizer.businessName}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Contact Name
							</dt>
							<dd className="mt-1">{organizer.contactName}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Email
							</dt>
							<dd className="mt-1">{organizer.contactEmail}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Phone
							</dt>
							<dd className="mt-1">{organizer.contactPhone}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								City
							</dt>
							<dd className="mt-1">{organizer.city}</dd>
						</div>
						{organizer.website ? (
							<div>
								<dt className="text-sm font-medium text-muted-foreground">
									Website
								</dt>
								<dd className="mt-1">
									<a
										href={organizer.website}
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary underline"
									>
										{organizer.website}
									</a>
								</dd>
							</div>
						) : null}
						{organizer.description ? (
							<div className="sm:col-span-2">
								<dt className="text-sm font-medium text-muted-foreground">
									Description
								</dt>
								<dd className="mt-1">{organizer.description}</dd>
							</div>
						) : null}
					</dl>
				</CardContent>
			</Card>

			{/* 2. Document Checklist */}
			<Card>
				<CardHeader>
					<CardTitle>Document Checklist</CardTitle>
					<CardDescription>
						{documents.length} of {VERIFICATION_DOCUMENT_TYPES.length} documents
						uploaded
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-3 sm:grid-cols-2">
						{VERIFICATION_DOCUMENT_TYPES.map((docType) => {
							const doc = docsByType.get(docType);
							const isUploaded = doc?.status === "uploaded";

							return (
								<div
									key={docType}
									className={`flex items-center justify-between rounded-md border p-3 ${
										isUploaded
											? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
											: "border-muted"
									}`}
								>
									<div className="flex items-center gap-2">
										{isUploaded ? (
											<CheckCircle2 className="size-4 shrink-0 text-green-600" />
										) : (
											<FileText className="size-4 shrink-0 text-muted-foreground" />
										)}
										<div>
											<p
												className={`text-sm font-medium ${
													isUploaded ? "text-green-700 dark:text-green-400" : ""
												}`}
											>
												{VERIFICATION_DOCUMENT_TYPE_LABELS[
													docType as VerificationDocumentType
												] ?? docType}
											</p>
											{doc ? (
												<p className="text-xs text-muted-foreground">
													{doc.fileName}
												</p>
											) : null}
										</div>
									</div>
									<div className="flex items-center gap-2">
										{isUploaded ? (
											<>
												<Badge
													variant="outline"
													className="text-[10px] text-green-600"
												>
													Uploaded
												</Badge>
												<ViewDocumentButton
													organizerId={organizerId}
													documentId={doc.id}
												/>
											</>
										) : (
											<Badge variant="secondary" className="text-[10px]">
												Missing
											</Badge>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* 3. Policy Status */}
			<Card>
				<CardHeader>
					<CardTitle>Policy Acceptance</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							{policiesAccepted ? (
								<ShieldCheck className="size-5 text-green-600" />
							) : (
								<XCircle className="size-5 text-destructive" />
							)}
							<span className="font-medium">
								{policiesAccepted
									? "All required policies accepted"
									: "Not all policies accepted"}
							</span>
						</div>
						{policyDetails.length > 0 ? (
							<div className="grid gap-2 sm:grid-cols-2">
								{policyDetails.map((policy) => (
									<div
										key={policy.policyType}
										className="flex items-center gap-2 rounded-md border p-2 text-sm"
									>
										{policy.isAccepted ? (
											<CheckCircle2 className="size-4 shrink-0 text-green-600" />
										) : (
											<XCircle className="size-4 shrink-0 text-muted-foreground" />
										)}
										<div>
											<p className="font-medium capitalize">
												{policy.policyType.replace(/_/g, " ")}
											</p>
											{policy.acceptedAt ? (
												<p className="text-xs text-muted-foreground">
													Accepted {formatDate(policy.acceptedAt)}
												</p>
											) : null}
										</div>
									</div>
								))}
							</div>
						) : null}
					</div>
				</CardContent>
			</Card>

			{/* 4. SLA Info */}
			<Card>
				<CardHeader>
					<CardTitle>Timeline</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-4 sm:grid-cols-2">
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Profile Created
							</dt>
							<dd className="mt-1">{formatDate(organizer.createdAt)}</dd>
						</div>
						{organizer.submittedForReviewAt ? (
							<div>
								<dt className="text-sm font-medium text-muted-foreground">
									Submitted for Review
								</dt>
								<dd className="mt-1">
									{formatDate(organizer.submittedForReviewAt)}
								</dd>
							</div>
						) : null}
						{organizer.reviewedAt ? (
							<div>
								<dt className="text-sm font-medium text-muted-foreground">
									Reviewed At
								</dt>
								<dd className="mt-1">{formatDate(organizer.reviewedAt)}</dd>
							</div>
						) : null}
					</dl>
					{isPendingReview ? (
						<Alert className="mt-4">
							<Clock className="size-4" />
							<AlertTitle>Awaiting Review</AlertTitle>
							<AlertDescription>
								This application is pending admin review. SLA target: 2 business
								days from submission.
							</AlertDescription>
						</Alert>
					) : null}
				</CardContent>
			</Card>

			{/* 5. Review Actions */}
			{isPendingReview ? (
				<Card>
					<CardHeader>
						<CardTitle>Review Actions</CardTitle>
						<CardDescription>
							Approve or reject this organizer's verification application
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex gap-3">
							<Button
								onClick={() => setDialogState({ open: true, type: "approve" })}
							>
								<ShieldCheck className="mr-2 size-4" />
								Approve
							</Button>
							<Button
								variant="destructive"
								onClick={() => setDialogState({ open: true, type: "reject" })}
							>
								<XCircle className="mr-2 size-4" />
								Reject
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}

			<ReviewActionDialog
				type={dialogState.type}
				organizerId={organizerId}
				open={dialogState.open}
				onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
				onSuccess={handleActionSuccess}
			/>
		</div>
	);
}
