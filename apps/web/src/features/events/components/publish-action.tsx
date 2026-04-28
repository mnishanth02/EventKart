import type { EventPublishTransition } from "@repo/shared/schemas";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { publishEvent } from "../api";
import { eventQueryKey, publishReadinessQueryKey } from "../queries";

const READINESS_ERROR_CODES = new Set([
	"EVENT_INCOMPLETE",
	"EVENT_DATE_IN_PAST",
	"EVENT_PRICING_INACTIVE",
	"EVENT_SLUG_CONFLICT",
	"ORGANIZER_NOT_VERIFIED",
	"RAZORPAY_NOT_LINKED",
]);

function getMutationErrorMessage(error: unknown): string {
	const message =
		error instanceof Error && error.message.trim()
			? error.message
			: "Publish failed";
	const code =
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
			? error.code
			: null;

	return code ? `${message} (${code})` : message;
}

function getPublishSuccessMessage(transition: EventPublishTransition): string {
	switch (transition) {
		case "draft_to_under_review":
			return "Event submitted for review.";
		case "noop_already_published":
			return "Event was already published.";
		case "noop_already_under_review":
			return "Event was already under review.";
		default:
			return "Event published.";
	}
}

export function PublishAction({
	eventId,
	ready,
	disabledReason,
}: {
	eventId: string;
	ready: boolean;
	disabledReason?: string;
}) {
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: () => publishEvent({ data: { eventId } }),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: eventQueryKey(eventId) }),
				queryClient.invalidateQueries({
					queryKey: publishReadinessQueryKey(eventId),
				}),
			]);
		},
		onError: async (error) => {
			const code =
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				typeof error.code === "string"
					? error.code
					: null;
			if (code && READINESS_ERROR_CODES.has(code)) {
				await queryClient.invalidateQueries({
					queryKey: publishReadinessQueryKey(eventId),
				});
			}
		},
	});
	const disabled = !ready || mutation.isPending;

	return (
		<div className="space-y-2">
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button type="button" disabled={disabled} aria-disabled={disabled}>
						{mutation.isPending ? "Publishing..." : "Publish event"}
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Publish this event?</AlertDialogTitle>
						<AlertDialogDescription>
							Published events become visible to participants. You can unpublish
							later if needed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={mutation.isPending}
							onClick={() => mutation.mutate()}
						>
							Confirm publish
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{disabledReason && !ready ? (
				<p className="text-muted-foreground text-sm">{disabledReason}</p>
			) : null}
			{mutation.isError ? (
				<p className="text-destructive text-sm" role="alert">
					{getMutationErrorMessage(mutation.error)}
				</p>
			) : null}
			{mutation.isSuccess ? (
				<p className="text-sm" role="status" aria-live="polite">
					{getPublishSuccessMessage(mutation.data.transition)}
				</p>
			) : null}
		</div>
	);
}
