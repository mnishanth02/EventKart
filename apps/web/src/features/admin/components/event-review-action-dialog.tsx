import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { toastRetry } from "@/components/design-system";
import { approveEventReview, rejectEventReview } from "../api";
import { ADMIN_EVENT_REVIEWS_QUERY_KEY } from "../queries";

export function EventReviewActionDialog({
	type,
	eventId,
	open,
	onOpenChange,
	onSuccess,
}: {
	type: "approve" | "reject";
	eventId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}) {
	const queryClient = useQueryClient();
	const [notes, setNotes] = useState("");
	const [reason, setReason] = useState("");
	const isApprove = type === "approve";

	const mutation = useMutation({
		mutationFn: () =>
			isApprove
				? approveEventReview({
						data: {
							eventId,
							body: notes.trim() ? { notes } : {},
						},
					})
				: rejectEventReview({
						data: {
							eventId,
							body: { reason },
						},
					}),
		onSuccess: () => {
			toast.success(isApprove ? "Event published" : "Event returned to draft");
			void queryClient.invalidateQueries({
				queryKey: ADMIN_EVENT_REVIEWS_QUERY_KEY,
			});
			setNotes("");
			setReason("");
			onOpenChange(false);
			onSuccess();
		},
		onError: (error: Error) => {
			toastRetry(error.message || "Failed to update event review", {
				onRetry: () => mutation.mutate(),
			});
		},
	});

	const canSubmit = isApprove || reason.trim().length >= 10;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isApprove ? "Approve event publish?" : "Reject event publish?"}
					</DialogTitle>
					<DialogDescription>
						{isApprove
							? "Approving publishes the event immediately."
							: "Rejecting returns the event to draft. The reason is recorded in the audit log."}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="event-review-reason">
						{isApprove ? "Notes (optional)" : "Rejection reason"}
					</Label>
					<Textarea
						id="event-review-reason"
						value={isApprove ? notes : reason}
						onChange={(event) =>
							isApprove
								? setNotes(event.target.value)
								: setReason(event.target.value)
						}
						placeholder={
							isApprove
								? "Optional audit note"
								: "Explain what the organizer must fix"
						}
					/>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant={isApprove ? "default" : "destructive"}
						disabled={!canSubmit || mutation.isPending}
						onClick={() => mutation.mutate()}
					>
						{mutation.isPending ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : null}
						{isApprove ? "Approve & publish" : "Reject to draft"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
