import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	VERIFICATION_STEPS,
	VERIFICATION_DOCUMENT_TYPE_LABELS,
	VERIFICATION_STATUS_LABELS,
} from "@repo/shared/constants";
import type {
	VerificationDocumentType,
	VerificationStatus,
} from "@repo/shared/constants";
import type { VerificationStatusResponse } from "../types";
import { verificationStatusQueryOptions } from "../queries";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/ui/components/ui/alert";
import {
	CheckCircle2,
	Circle,
	Clock,
	AlertTriangle,
	ShieldCheck,
	FileText,
	XCircle,
} from "lucide-react";

function formatDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateStr));
}

function getStatusBadgeVariant(
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

/**
 * Determine which step index (0–4) is "current" based on verification status.
 */
function getCurrentStepIndex(data: VerificationStatusResponse): number {
	if (data.verificationStatus === "approved") return 4;
	if (
		data.verificationStatus === "rejected" ||
		data.verificationStatus === "pending_review"
	)
		return 3;
	if (data.steps.documents.completed) return 3;
	if (data.steps.policies.completed) return 2;
	if (data.steps.registration.completed) return 1;
	return 0;
}

function isStepCompleted(
	stepIndex: number,
	data: VerificationStatusResponse,
): boolean {
	const step = VERIFICATION_STEPS[stepIndex];
	if (!step) return false;

	switch (step.id) {
		case "registration":
			return data.steps.registration.completed;
		case "policies":
			return data.steps.policies.completed;
		case "documents":
			return data.steps.documents.completed;
		case "review":
			return (
				data.steps.review.status === "approved" ||
				data.steps.review.status === "pending"
			);
		case "approved":
			return data.verificationStatus === "approved";
		default:
			return false;
	}
}

function getStepSubtext(
	stepIndex: number,
	data: VerificationStatusResponse,
): string | null {
	const step = VERIFICATION_STEPS[stepIndex];
	if (!step) return null;

	switch (step.id) {
		case "documents": {
			const { uploadedCount, total } = data.steps.documents;
			return `${String(uploadedCount)}/${String(total)} uploaded`;
		}
		case "review":
			if (data.steps.review.status === "pending") return "Under review";
			if (data.steps.review.status === "rejected") return "Rejected";
			if (data.steps.review.status === "not_ready") return "Not yet submitted";
			return null;
		default:
			return null;
	}
}

// ── Progress Stepper ────────────────────────────────────────────────

function ProgressStepper({ data }: { data: VerificationStatusResponse }) {
	const currentIndex = getCurrentStepIndex(data);

	return (
		<div className="flex items-start gap-0">
			{VERIFICATION_STEPS.map((step, index) => {
				const completed = isStepCompleted(index, data);
				const isCurrent = index === currentIndex && !completed;
				const isRejected =
					step.id === "review" && data.steps.review.status === "rejected";
				const subtext = getStepSubtext(index, data);

				return (
					<div key={step.id} className="flex flex-1 items-start">
						<div className="flex flex-col items-center gap-1">
							<div
								className={`flex size-8 items-center justify-center rounded-full border-2 ${
									completed
										? "border-green-600 bg-green-600 text-white"
										: isRejected
											? "border-destructive bg-destructive text-white"
											: isCurrent
												? "border-primary bg-primary/10 text-primary"
												: "border-muted-foreground/30 text-muted-foreground/50"
								}`}
							>
								{completed ? (
									<CheckCircle2 className="size-4" />
								) : isRejected ? (
									<XCircle className="size-4" />
								) : isCurrent ? (
									<Clock className="size-4" />
								) : (
									<Circle className="size-4" />
								)}
							</div>
							<span
								className={`text-center text-xs font-medium ${
									completed
										? "text-green-700 dark:text-green-400"
										: isCurrent
											? "text-primary"
											: isRejected
												? "text-destructive"
												: "text-muted-foreground/60"
								}`}
							>
								{step.label}
							</span>
							{subtext ? (
								<span className="text-center text-[10px] text-muted-foreground">
									{subtext}
								</span>
							) : null}
						</div>
						{index < VERIFICATION_STEPS.length - 1 ? (
							<div
								className={`mt-4 h-0.5 flex-1 ${
									isStepCompleted(index, data)
										? "bg-green-600"
										: "bg-muted-foreground/20"
								}`}
							/>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

// ── Document Checklist ──────────────────────────────────────────────

function DocumentChecklist({ data }: { data: VerificationStatusResponse }) {
	const allDocTypes: VerificationDocumentType[] = [
		"aadhaar",
		"pan",
		"gst_certificate",
		"bank_proof",
	];
	const uploadedSet = new Set(data.steps.documents.uploaded);

	return (
		<div className="space-y-2">
			<h3 className="text-sm font-semibold">Document Checklist</h3>
			<div className="grid gap-2 sm:grid-cols-2">
				{allDocTypes.map((docType) => {
					const isUploaded = uploadedSet.has(docType);
					return (
						<div
							key={docType}
							className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
								isUploaded
									? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
									: "border-muted"
							}`}
						>
							{isUploaded ? (
								<CheckCircle2 className="size-4 text-green-600 shrink-0" />
							) : (
								<FileText className="size-4 text-muted-foreground shrink-0" />
							)}
							<span
								className={
									isUploaded ? "text-green-700 dark:text-green-400" : ""
								}
							>
								{VERIFICATION_DOCUMENT_TYPE_LABELS[docType]}
							</span>
							{isUploaded ? (
								<Badge variant="outline" className="ml-auto text-[10px]">
									Uploaded
								</Badge>
							) : (
								<Badge
									variant="secondary"
									className="ml-auto text-[10px]"
								>
									Missing
								</Badge>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ── Status Banners ──────────────────────────────────────────────────

function PendingReviewBanner({
	data,
}: { data: VerificationStatusResponse }) {
	return (
		<Alert>
			<Clock className="size-4" />
			<AlertTitle>Application Under Review</AlertTitle>
			<AlertDescription className="space-y-1">
				<p>
					Submitted on {formatDate(data.steps.review.submittedAt)}
				</p>
				{data.steps.review.expectedBy ? (
					<p>
						Expected review by{" "}
						{formatDate(data.steps.review.expectedBy)}
					</p>
				) : null}
				<p className="text-muted-foreground text-xs">
					Our team typically reviews applications within 2 business
					days.
				</p>
			</AlertDescription>
		</Alert>
	);
}

function RejectionBanner({ data }: { data: VerificationStatusResponse }) {
	return (
		<Alert variant="destructive">
			<AlertTriangle className="size-4" />
			<AlertTitle>Verification Not Approved</AlertTitle>
			<AlertDescription className="space-y-2">
				{data.rejectionReason ? (
					<p className="font-medium">{data.rejectionReason}</p>
				) : null}
				<p>
					Please review the feedback and re-upload documents as
					needed.
				</p>
				<Button asChild variant="outline" size="sm" className="mt-2">
					<Link to="/org/verification">Upload Documents</Link>
				</Button>
			</AlertDescription>
		</Alert>
	);
}

function ApprovedBanner() {
	return (
		<Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
			<ShieldCheck className="size-4 text-green-600" />
			<AlertTitle className="text-green-700 dark:text-green-400">
				Verified Organizer
			</AlertTitle>
			<AlertDescription className="text-green-600 dark:text-green-400">
				Your organizer account is verified. You can now create and
				publish events.
			</AlertDescription>
		</Alert>
	);
}

// ── Main Component ──────────────────────────────────────────────────

export function VerificationStatusTracker() {
	const { data, isLoading, isError } = useQuery(
		verificationStatusQueryOptions(),
	);

	if (isLoading) {
		return (
			<Card>
				<CardContent className="py-6">
					<p className="text-muted-foreground text-center">
						Loading verification status...
					</p>
				</CardContent>
			</Card>
		);
	}

	if (isError || !data) {
		return (
			<Card>
				<CardContent className="py-6">
					<p className="text-muted-foreground text-center">
						Unable to load verification status.
					</p>
				</CardContent>
			</Card>
		);
	}

	const status = data.verificationStatus as VerificationStatus;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Verification Progress</CardTitle>
					<Badge variant={getStatusBadgeVariant(status)}>
						{VERIFICATION_STATUS_LABELS[status] ?? status}
					</Badge>
				</div>
				<CardDescription>
					Complete all steps to get your organizer account verified.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<ProgressStepper data={data} />

				{status === "approved" ? <ApprovedBanner /> : null}
				{status === "rejected" ? (
					<RejectionBanner data={data} />
				) : null}
				{status === "pending_review" ? (
					<PendingReviewBanner data={data} />
				) : null}

				{status !== "approved" ? (
					<DocumentChecklist data={data} />
				) : null}
			</CardContent>
		</Card>
	);
}
