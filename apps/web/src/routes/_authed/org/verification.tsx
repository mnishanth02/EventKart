import { createFileRoute } from "@tanstack/react-router";
import { VerificationDocuments } from "#/features/organizer/components/verification-documents";
import { VerificationStatusTracker } from "#/features/organizer/components/verification-status-tracker";

export const Route = createFileRoute("/_authed/org/verification")({
	component: VerificationPage,
});

function VerificationPage() {
	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<h1 className="text-2xl font-bold">Organizer Verification</h1>
			<VerificationStatusTracker />
			<VerificationDocuments />
		</div>
	);
}
