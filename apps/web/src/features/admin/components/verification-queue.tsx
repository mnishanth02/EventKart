import {
	VERIFICATION_STATUS_LABELS,
	type VerificationStatus,
} from "@repo/shared/constants";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useState } from "react";
import { adminVerificationsQueryOptions } from "../queries";
import { VerificationSlaBadge } from "./verification-sla-badge";

const STATUS_FILTER_OPTIONS = [
	{ value: "all", label: "All Statuses" },
	{ value: "pending_review", label: "Pending Review" },
	{ value: "pending_documents", label: "Pending Documents" },
	{ value: "approved", label: "Approved" },
	{ value: "rejected", label: "Rejected" },
] as const;

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

function formatDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
	}).format(new Date(dateStr));
}

export function VerificationQueue() {
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState("all");

	const queryParams = {
		page,
		limit: 20,
		status: statusFilter === "all" ? undefined : statusFilter,
	};

	const { data, isLoading, isError, refetch } = useQuery(
		adminVerificationsQueryOptions(queryParams),
	);

	const items = data?.items ?? [];
	const meta = data?.meta;
	const selectedStatusLabel =
		STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)
			?.label ?? "selected status";
	const emptyStateSubject =
		statusFilter === "all"
			? "verification"
			: `${selectedStatusLabel.toLowerCase()} verification`;

	function handleStatusFilterChange(value: string) {
		setStatusFilter(value);
		setPage(1);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Verification Queue</CardTitle>
						<CardDescription>
							Review and manage organizer verification applications
						</CardDescription>
					</div>
					<Select value={statusFilter} onValueChange={handleStatusFilterChange}>
						<SelectTrigger
							className="w-full sm:w-48"
							aria-label="Filter verifications by status"
						>
							<SelectValue placeholder="Filter by status" />
						</SelectTrigger>
						<SelectContent>
							{STATUS_FILTER_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<p
						className="py-8 text-center text-muted-foreground"
						role="status"
						aria-live="polite"
					>
						Loading verifications...
					</p>
				) : isError ? (
					<div
						className="flex flex-col items-center gap-3 py-8 text-center"
						role="alert"
					>
						<p className="text-destructive">
							Failed to load verifications. Please try again.
						</p>
						<Button variant="outline" size="sm" onClick={() => void refetch()}>
							Retry
						</Button>
					</div>
				) : items.length === 0 ? (
					<div className="flex flex-col items-center gap-3 py-8 text-center">
						<p className="text-muted-foreground">
							No {emptyStateSubject} applications found.
						</p>
						{statusFilter !== "all" ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleStatusFilterChange("all")}
							>
								Show all statuses
							</Button>
						) : null}
					</div>
				) : (
					<>
						<div className="overflow-x-auto rounded-md border">
							<Table className="min-w-[900px]">
								<caption className="sr-only">
									Organizer verification applications
								</caption>
								<TableHeader>
									<TableRow>
										<TableHead>Business Name</TableHead>
										<TableHead>Contact</TableHead>
										<TableHead>City</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Submitted</TableHead>
										<TableHead>SLA</TableHead>
										<TableHead>Docs</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((item) => (
										<TableRow key={item.id}>
											<TableCell className="font-medium">
												{item.businessName}
											</TableCell>
											<TableCell>
												<div className="text-sm">
													<p>{item.contactName}</p>
													<p className="text-muted-foreground">
														{item.contactEmail}
													</p>
												</div>
											</TableCell>
											<TableCell>{item.city}</TableCell>
											<TableCell>
												<Badge
													variant={getStatusBadgeVariant(
														item.verificationStatus,
													)}
												>
													{VERIFICATION_STATUS_LABELS[
														item.verificationStatus as VerificationStatus
													] ?? item.verificationStatus}
												</Badge>
											</TableCell>
											<TableCell>
												{formatDate(item.submittedForReviewAt)}
											</TableCell>
											<TableCell>
												<VerificationSlaBadge
													status={item.verificationStatus}
													submittedForReviewAt={item.submittedForReviewAt}
												/>
											</TableCell>
											<TableCell>{item.documentCount}/4</TableCell>
											<TableCell className="text-right">
												<Button variant="ghost" size="sm" asChild>
													<Link
														to="/admin/verifications/$organizerId"
														params={{ organizerId: item.id }}
													>
														<Eye className="mr-1 size-4" />
														Review
													</Link>
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						{meta ? (
							<div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-sm text-muted-foreground">
									Page {meta.page} of {meta.totalPages} ({meta.total} total)
								</p>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										className="flex-1 sm:flex-none"
										disabled={!meta.hasPrev}
										onClick={() => setPage((p) => Math.max(1, p - 1))}
										aria-label="Go to previous verification page"
									>
										<ChevronLeft className="mr-1 size-4" />
										Previous
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="flex-1 sm:flex-none"
										disabled={!meta.hasNext}
										onClick={() => setPage((p) => p + 1)}
										aria-label="Go to next verification page"
									>
										Next
										<ChevronRight className="ml-1 size-4" />
									</Button>
								</div>
							</div>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}
