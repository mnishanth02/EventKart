import { createFileRoute } from "@tanstack/react-router";
import { PolicyAcceptanceForm } from "#/features/organizer/components/policy-acceptance-form";

export const Route = createFileRoute("/_authed/org/policies")({
	component: PoliciesPage,
});

function PoliciesPage() {
	return (
		<div className="mx-auto max-w-2xl py-8">
			<PolicyAcceptanceForm />
		</div>
	);
}
