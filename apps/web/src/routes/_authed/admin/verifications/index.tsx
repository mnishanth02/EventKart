import { createFileRoute } from "@tanstack/react-router";
import { VerificationQueue } from "#/features/admin/components/verification-queue";

export const Route = createFileRoute("/_authed/admin/verifications/")({
	component: VerificationsPage,
	ssr: "data-only",
});

function VerificationsPage() {
	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Organizer Verifications</h1>
			<VerificationQueue />
		</div>
	);
}
