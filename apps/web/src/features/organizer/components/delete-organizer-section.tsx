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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthActions } from "#/features/auth/hooks";
import { toastRetry } from "@/components/design-system";
import { deleteOrganizerAccount } from "../api";
import { organizerDeletionPreviewQueryOptions } from "../queries";

export function DeleteOrganizerSection() {
	const [open, setOpen] = useState(false);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { clearSession } = useAuthActions();

	const previewQuery = useQuery({
		...organizerDeletionPreviewQueryOptions(),
		enabled: open,
	});

	const deleteMutation = useMutation({
		mutationFn: deleteOrganizerAccount,
		onSuccess: () => {
			queryClient.clear();
			clearSession();
			toast.success("Organizer account deleted.");
			void navigate({ to: "/", replace: true });
		},
		onError: () => {
			toastRetry("Failed to delete account. Please try again.", {
				onRetry: () => {
					void deleteOrganizerAccount();
				},
			});
		},
	});

	return (
		<Card className="border-destructive/40">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-destructive">
					<AlertTriangleIcon className="size-5" />
					Danger zone
				</CardTitle>
				<CardDescription>
					Permanently delete your organizer account and all associated data.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<AlertDialog open={open} onOpenChange={setOpen}>
					<AlertDialogTrigger asChild>
						<Button variant="destructive">Delete organizer account</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								Delete organizer account permanently?
							</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. Your organizer profile and future
								events will be permanently removed.
							</AlertDialogDescription>
						</AlertDialogHeader>

						{previewQuery.isLoading ? (
							<div className="space-y-3 py-2">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
								<Skeleton className="h-4 w-2/3" />
							</div>
						) : previewQuery.isError ? (
							<p className="text-destructive text-sm py-2" role="alert">
								Failed to load deletion preview. Please close and try again.
							</p>
						) : previewQuery.data ? (
							<DeletionPreviewContent preview={previewQuery.data} />
						) : null}

						<AlertDialogFooter>
							<AlertDialogCancel disabled={deleteMutation.isPending}>
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								disabled={
									deleteMutation.isPending ||
									previewQuery.isLoading ||
									previewQuery.isError
								}
								onClick={(e) => {
									e.preventDefault();
									deleteMutation.mutate();
								}}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{deleteMutation.isPending
									? "Deleting..."
									: "Permanently delete"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</CardContent>
		</Card>
	);
}

function DeletionPreviewContent({
	preview,
}: {
	preview: {
		businessName: string;
		futureEvents: Array<{ title: string; startAt: string }>;
		preservedEventCount: number;
		hasRazorpayAccount: boolean;
		kycDocumentCount: number;
	};
}) {
	return (
		<div className="space-y-4 py-2 text-sm">
			<p>
				You are about to delete the organizer account for{" "}
				<span className="font-semibold">{preview.businessName}</span>.
			</p>

			{preview.futureEvents.length > 0 ? (
				<div className="space-y-1">
					<p className="font-medium text-destructive">
						Future events that will be permanently deleted:
					</p>
					<ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
						{preview.futureEvents.map((event) => (
							<li key={`${event.title}-${event.startAt}`}>
								{event.title} —{" "}
								{new Date(event.startAt).toLocaleDateString(undefined, {
									dateStyle: "medium",
								})}
							</li>
						))}
					</ul>
				</div>
			) : null}

			{preview.preservedEventCount > 0 ? (
				<div className="space-y-1">
					<p className="font-medium">
						{preview.preservedEventCount} past/active event
						{preview.preservedEventCount === 1 ? "" : "s"} will be preserved.
					</p>
					<p className="text-muted-foreground">
						These events will remain visible to participants who registered and
						to anyone who has the link, with your organizer details still shown.
					</p>
				</div>
			) : null}

			{preview.kycDocumentCount > 0 ? (
				<p className="text-muted-foreground">
					Your verification documents will be retained for 365 days as required
					by law and then deleted automatically.
				</p>
			) : null}

			{preview.hasRazorpayAccount ? (
				<p className="text-muted-foreground">
					Your linked Razorpay account will be suspended.
				</p>
			) : null}
		</div>
	);
}
