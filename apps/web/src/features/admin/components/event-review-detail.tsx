import { EVENT_STATUS_LABELS } from "@repo/shared/constants";
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
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	CheckCircle2,
	Loader2,
	ShieldCheck,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { adminEventReviewDetailQueryOptions } from "../queries";
import { EventReviewActionDialog } from "./event-review-action-dialog";

function formatDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateStr));
}

function formatDistance(distanceMeters: number): string {
	return `${(distanceMeters / 1000).toLocaleString("en-IN", {
		maximumFractionDigits: 2,
	})} km`;
}

function formatPrice(paise: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(paise / 100);
}

export function EventReviewDetail({ eventId }: { eventId: string }) {
	const navigate = useNavigate();
	const [dialogState, setDialogState] = useState<{
		open: boolean;
		type: "approve" | "reject";
	}>({ open: false, type: "approve" });

	const { data, isLoading, isError, refetch } = useQuery(
		adminEventReviewDetailQueryOptions(eventId),
	);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<Button variant="ghost" size="sm" asChild>
					<Link to="/admin/event-reviews">
						<ArrowLeft className="mr-1 size-4" />
						Back to Event Reviews
					</Link>
				</Button>
				<div className="flex items-center justify-center py-12" role="status">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
					<span className="ml-2 text-muted-foreground">Loading event...</span>
				</div>
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="space-y-6">
				<Button variant="ghost" size="sm" asChild>
					<Link to="/admin/event-reviews">
						<ArrowLeft className="mr-1 size-4" />
						Back to Event Reviews
					</Link>
				</Button>
				<Alert variant="destructive">
					<XCircle className="size-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription className="space-y-3">
						<p>Failed to load event review details.</p>
						<Button variant="outline" size="sm" onClick={() => void refetch()}>
							Try again
						</Button>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	const { event, organizer, configuration } = data;
	const isReviewable = event.status === "under_review";

	function handleActionSuccess() {
		void navigate({ to: "/admin/event-reviews" });
	}

	return (
		<div className="space-y-6">
			<Button variant="ghost" size="sm" asChild>
				<Link to="/admin/event-reviews">
					<ArrowLeft className="mr-1 size-4" />
					Back to Event Reviews
				</Link>
			</Button>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">{event.title}</h1>
					<p className="text-muted-foreground">Review event {eventId}</p>
				</div>
				<Badge variant={isReviewable ? "secondary" : "outline"}>
					{EVENT_STATUS_LABELS[event.status]}
				</Badge>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Event Details</CardTitle>
					<CardDescription>{event.slug}</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-4 sm:grid-cols-2">
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Venue
							</dt>
							<dd className="mt-1">{event.venueName}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								City
							</dt>
							<dd className="mt-1">{event.city}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Starts
							</dt>
							<dd className="mt-1">{formatDate(event.startAt)}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Ends
							</dt>
							<dd className="mt-1">{formatDate(event.endAt)}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Submitted for review
							</dt>
							<dd className="mt-1">{formatDate(event.submittedForReviewAt)}</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Paid event
							</dt>
							<dd className="mt-1">{event.isPaid ? "Yes" : "No"}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Organizer</CardTitle>
					<CardDescription>{organizer.businessName}</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-4 sm:grid-cols-2">
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Contact
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
								Verification
							</dt>
							<dd className="mt-1 flex items-center gap-2">
								{organizer.isVerified ? (
									<CheckCircle2 className="size-4 text-green-600" />
								) : (
									<XCircle className="size-4 text-destructive" />
								)}
								{organizer.isVerified ? "Verified" : "Not verified"}
							</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-muted-foreground">
								Paid published history
							</dt>
							<dd className="mt-1">
								{organizer.previouslyPublishedPaidEventCount}/3 events
							</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Category & pricing context</CardTitle>
					<CardDescription>
						Distance options, capacity, and paid tiers configured by the
						organizer.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{configuration.categories.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No categories configured yet.
						</p>
					) : (
						<div className="grid gap-3 md:grid-cols-2">
							{configuration.categories.map((category) => (
								<div key={category.id} className="rounded-md border p-3">
									<p className="font-medium">{category.name}</p>
									<p className="text-muted-foreground text-sm">
										{formatDistance(category.distanceMeters)} · {category.slug}
									</p>
									<p className="text-muted-foreground text-sm">
										Capacity {category.spotsRemaining}/{category.spotsTotal}{" "}
										remaining
									</p>
								</div>
							))}
						</div>
					)}

					{configuration.pricingTiers.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No pricing tiers configured yet.
						</p>
					) : (
						<div className="grid gap-3 md:grid-cols-2">
							{configuration.pricingTiers.map((tier) => (
								<div key={tier.id} className="rounded-md border p-3">
									<p className="font-medium">{tier.category.name}</p>
									<p className="text-muted-foreground text-sm">
										Base {formatPrice(tier.basePrice)}
									</p>
									{tier.earlyBirdPrice ? (
										<p className="text-muted-foreground text-sm">
											Early bird {formatPrice(tier.earlyBirdPrice)} until{" "}
											{formatDate(tier.earlyBirdDeadline)}
										</p>
									) : null}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Policies</CardTitle>
					<CardDescription>
						Participant-facing refund and cancellation terms.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 md:grid-cols-2">
					<div className="rounded-md border p-3">
						<p className="font-medium">Refund policy</p>
						<p className="mt-1 whitespace-pre-wrap text-muted-foreground text-sm">
							{configuration.policies.refundPolicy || "Not configured"}
						</p>
					</div>
					<div className="rounded-md border p-3">
						<p className="font-medium">Cancellation policy</p>
						<p className="mt-1 whitespace-pre-wrap text-muted-foreground text-sm">
							{configuration.policies.cancellationPolicy || "Not configured"}
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Publish readiness context</CardTitle>
					<CardDescription>
						{configuration.readiness.ready
							? "All publish gates currently pass."
							: "One or more publish gates still need attention."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<Badge
							variant={configuration.readiness.ready ? "default" : "secondary"}
						>
							{configuration.readiness.ready ? "Ready" : "Not ready"}
						</Badge>
						{configuration.readiness.requiresRazorpay ? (
							<Badge variant="outline">Razorpay required</Badge>
						) : null}
						{configuration.readiness.wouldRequireAdminReview ? (
							<Badge variant="outline">Admin review required</Badge>
						) : null}
					</div>
					<ul className="space-y-2" aria-label="Admin publish readiness checks">
						{configuration.readiness.items.map((item) => (
							<li key={item.check} className="flex items-start gap-2 text-sm">
								<span aria-hidden="true">{item.passed ? "✅" : "⚠️"}</span>
								<span>{item.message}</span>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>

			{isReviewable ? (
				<Card>
					<CardHeader>
						<CardTitle>Review Actions</CardTitle>
						<CardDescription>
							Approve publishes immediately. Rejecting returns the event to
							draft.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-3 sm:flex-row">
							<Button
								className="w-full sm:w-auto"
								onClick={() => setDialogState({ open: true, type: "approve" })}
							>
								<ShieldCheck className="mr-2 size-4" />
								Approve & publish
							</Button>
							<Button
								variant="destructive"
								className="w-full sm:w-auto"
								onClick={() => setDialogState({ open: true, type: "reject" })}
							>
								<XCircle className="mr-2 size-4" />
								Reject to draft
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}

			<EventReviewActionDialog
				type={dialogState.type}
				eventId={eventId}
				open={dialogState.open}
				onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
				onSuccess={handleActionSuccess}
			/>
		</div>
	);
}
