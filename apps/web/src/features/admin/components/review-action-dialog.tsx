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
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { toastRetry } from "@/components/design-system";
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
	const textId = useId();
	const queryClient = useQueryClient();

	const isReject = type === "reject";
	const trimmedLength = text.trim().length;
	const isValid = isReject ? trimmedLength >= 10 : true;
	const errorId = `${textId}-error`;
	const helpId = `${textId}-help`;

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
			toastRetry(error.message || `Failed to ${type} organizer`, {
				onRetry: () => mutation.mutate(),
			});
		},
	});

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && !mutation.isPending) {
			setText("");
		}
		onOpenChange(nextOpen);
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!isValid) return;
		mutation.mutate();
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isReject ? "Reject Organizer" : "Approve Organizer"}
					</DialogTitle>
					<DialogDescription>
						{isReject
							? "Rejecting moves this application to Rejected and shows the reason to the organizer."
							: "Approving marks this organizer as verified. Optional notes stay internal."}
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor={textId}>
							{isReject ? "Rejection reason" : "Approval notes"}
						</Label>
						<Textarea
							id={textId}
							placeholder={
								isReject
									? "Reason for rejection (min 10 characters)..."
									: "Optional approval notes..."
							}
							value={text}
							onChange={(e) => setText(e.target.value)}
							maxLength={2000}
							rows={4}
							aria-describedby={isReject ? `${helpId} ${errorId}` : helpId}
							aria-invalid={isReject && trimmedLength > 0 && !isValid}
							aria-required={isReject}
						/>
						<p id={helpId} className="text-sm text-muted-foreground">
							{isReject
								? "Provide at least 10 characters so the organizer can act on the feedback."
								: "These notes are internal and optional."}{" "}
							{trimmedLength}/2000
						</p>
						{isReject && trimmedLength > 0 && trimmedLength < 10 ? (
							<p id={errorId} className="text-sm text-destructive" role="alert">
								Reason must be at least 10 characters ({trimmedLength}/10)
							</p>
						) : null}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
							disabled={mutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant={isReject ? "destructive" : "default"}
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
				</form>
			</DialogContent>
		</Dialog>
	);
}
