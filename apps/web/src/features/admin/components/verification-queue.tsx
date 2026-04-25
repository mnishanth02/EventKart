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

	const { data, isLoading, isError } = useQuery(
		adminVerificationsQueryOptions(queryParams),
	);

	const items = data?.items ?? [];
	const meta = data?.meta;

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
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="w-48">
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
					<p className="text-muted-foreground py-8 text-center">
						Loading verifications...
					</p>
				) : isError ? (
					<p className="text-destructive py-8 text-center">
						Failed to load verifications. Please try again.
					</p>
				) : items.length === 0 ? (
					<p className="text-muted-foreground py-8 text-center">
						No verification applications found.
					</p>
				) : (
					<>
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Business Name</TableHead>
										<TableHead>Contact</TableHead>
										<TableHead>City</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Submitted</TableHead>
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
							<div className="flex items-center justify-between pt-4">
								<p className="text-sm text-muted-foreground">
									Page {meta.page} of {meta.totalPages} ({meta.total} total)
								</p>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={!meta.hasPrev}
										onClick={() => setPage((p) => Math.max(1, p - 1))}
									>
										<ChevronLeft className="mr-1 size-4" />
										Previous
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={!meta.hasNext}
										onClick={() => setPage((p) => p + 1)}
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
