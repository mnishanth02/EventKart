import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { approveOrganizer, rejectOrganizer } from "../api";
import { ADMIN_VERIFICATIONS_QUERY_KEY } from "../queries";

type ReviewActionDialogProps = {
	type: "approve" | "reject";
	organizerId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

export function ReviewActionDialog({
	type,
	organizerId,
	open,
	onOpenChange,
	onSuccess,
}: ReviewActionDialogProps) {
	const [text, setText] = useState("");
	const queryClient = useQueryClient();

	const isReject = type === "reject";
	const isValid = isReject ? text.trim().length >= 10 : true;

	const mutation = useMutation({
		mutationFn: async () => {
			if (isReject) {
				return rejectOrganizer({
					data: { organizerId, body: { reason: text.trim() } },
				});
			}
			return approveOrganizer({
				data: {
					organizerId,
					body: text.trim() ? { notes: text.trim() } : {},
				},
			});
		},
		onSuccess: () => {
			toast.success(
				isReject
					? "Organizer verification rejected"
					: "Organizer verification approved",
			);
			void queryClient.invalidateQueries({
				queryKey: ADMIN_VERIFICATIONS_QUERY_KEY,
			});
			setText("");
			onOpenChange(false);
			onSuccess();
		},
		onError: (error: Error) => {
			toast.error(error.message || `Failed to ${type} organizer`);
		},
	});

	function handleSubmit() {
		if (!isValid) return;
		mutation.mutate();
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isReject ? "Reject Organizer" : "Approve Organizer"}
					</DialogTitle>
					<DialogDescription>
						{isReject
							? "Provide a reason for rejecting this organizer's verification. This will be visible to the organizer."
							: "Optionally add notes for this approval. These are internal and not visible to the organizer."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2">
					<Textarea
						placeholder={
							isReject
								? "Reason for rejection (min 10 characters)..."
								: "Optional approval notes..."
						}
						value={text}
						onChange={(e) => setText(e.target.value)}
						rows={4}
					/>
					{isReject && text.trim().length > 0 && text.trim().length < 10 ? (
						<p className="text-sm text-destructive">
							Reason must be at least 10 characters ({text.trim().length}/10)
						</p>
					) : null}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						Cancel
					</Button>
					<Button
						variant={isReject ? "destructive" : "default"}
						onClick={handleSubmit}
						disabled={!isValid || mutation.isPending}
					>
						{mutation.isPending
							? isReject
								? "Rejecting..."
								: "Approving..."
							: isReject
								? "Reject"
								: "Approve"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
