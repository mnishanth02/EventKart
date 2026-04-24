import { createFileRoute } from "@tanstack/react-router";
import { VerificationDocuments } from "#/features/organizer/components/verification-documents";

export const Route = createFileRoute("/_authed/org/verification")({
	component: VerificationPage,
});

function VerificationPage() {
	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<h1 className="text-2xl font-bold">Organizer Verification</h1>
			<VerificationDocuments />
		</div>
	);
}
