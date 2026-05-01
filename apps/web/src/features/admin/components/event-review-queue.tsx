import {
	EVENT_STATUS_LABELS,
	EVENT_STATUSES,
	type EventStatus,
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
import { adminEventReviewsQueryOptions } from "../queries";

const STATUS_FILTER_OPTIONS = EVENT_STATUSES.map((status) => ({
	value: status,
	label: EVENT_STATUS_LABELS[status],
}));

function formatDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateStr));
}

export function EventReviewQueue() {
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState<EventStatus>("under_review");
	const { data, isLoading, isError, refetch } = useQuery(
		adminEventReviewsQueryOptions({
			page,
			limit: 20,
			status: statusFilter,
		}),
	);

	const items = data?.items ?? [];
	const meta = data?.meta;
	const selectedStatusLabel = EVENT_STATUS_LABELS[statusFilter];

	function handleStatusFilterChange(value: string) {
		setStatusFilter(value as EventStatus);
		setPage(1);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Event Review Queue</CardTitle>
						<CardDescription>
							Review first paid events from new organizers before public publish
						</CardDescription>
					</div>
					<Select value={statusFilter} onValueChange={handleStatusFilterChange}>
						<SelectTrigger
							className="w-full sm:w-48"
							aria-label="Filter event reviews by status"
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
						Loading event reviews...
					</p>
				) : isError ? (
					<div className="flex flex-col items-center gap-3 py-8 text-center">
						<p className="text-destructive">
							Failed to load event reviews. Please try again.
						</p>
						<Button variant="outline" size="sm" onClick={() => void refetch()}>
							Retry
						</Button>
					</div>
				) : items.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground">
						No {selectedStatusLabel.toLowerCase()} events found.
					</p>
				) : (
					<>
						<div className="overflow-x-auto rounded-md border">
							<Table className="min-w-[900px]">
								<caption className="sr-only">
									Events awaiting admin publish review
								</caption>
								<TableHeader>
									<TableRow>
										<TableHead>Event</TableHead>
										<TableHead>Organizer</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Submitted</TableHead>
										<TableHead>Starts</TableHead>
										<TableHead>Published history</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((item) => (
										<TableRow key={item.eventId}>
											<TableCell>
												<div className="text-sm">
													<p className="font-medium">{item.title}</p>
													<p className="text-muted-foreground">{item.slug}</p>
												</div>
											</TableCell>
											<TableCell>
												<div className="text-sm">
													<p>{item.organizerBusinessName}</p>
													<p className="text-muted-foreground">
														{item.organizerContactEmail}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant="secondary">
													{EVENT_STATUS_LABELS[item.status]}
												</Badge>
											</TableCell>
											<TableCell>
												{formatDate(item.submittedForReviewAt)}
											</TableCell>
											<TableCell>{formatDate(item.startAt)}</TableCell>
											<TableCell>
												{item.previouslyPublishedPaidEventCount}/3 paid events
											</TableCell>
											<TableCell className="text-right">
												<Button variant="ghost" size="sm" asChild>
													<Link
														to="/admin/event-reviews/$eventId"
														params={{ eventId: item.eventId }}
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
