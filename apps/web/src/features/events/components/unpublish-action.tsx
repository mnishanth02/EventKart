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
import { unpublishEvent } from "../api";
import { eventQueryKey, publishReadinessQueryKey } from "../queries";

function getMutationErrorMessage(error: unknown): string {
	const message =
		error instanceof Error && error.message.trim()
			? error.message
			: "Unpublish failed";
	const code =
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
			? error.code
			: null;

	return code ? `${message} (${code})` : message;
}

export function UnpublishAction({ eventId }: { eventId: string }) {
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: () => unpublishEvent({ data: { eventId } }),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: eventQueryKey(eventId) }),
				queryClient.invalidateQueries({
					queryKey: publishReadinessQueryKey(eventId),
				}),
			]);
		},
	});

	return (
		<div className="space-y-2">
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						type="button"
						variant="outline"
						disabled={mutation.isPending}
						aria-disabled={mutation.isPending}
					>
						{mutation.isPending ? "Unpublishing..." : "Unpublish event"}
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unpublish this event?</AlertDialogTitle>
						<AlertDialogDescription>
							The event will return to draft and no longer be publicly visible.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={mutation.isPending}
							onClick={() => mutation.mutate()}
						>
							Confirm unpublish
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{mutation.isError ? (
				<p className="text-destructive text-sm" role="alert">
					{getMutationErrorMessage(mutation.error)}
				</p>
			) : null}
			{mutation.isSuccess ? (
				<p className="text-sm" role="status" aria-live="polite">
					Event unpublished.
				</p>
			) : null}
		</div>
	);
}
