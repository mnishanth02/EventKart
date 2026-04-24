import { createFileRoute } from "@tanstack/react-router";
import { OrganizerRegistrationForm } from "#/features/organizer/components/organizer-registration-form";

export const Route = createFileRoute("/_authed/org/register")({
	component: OrganizerRegisterPage,
});

function OrganizerRegisterPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Complete Your Profile</h1>
				<p className="text-muted-foreground">
					Set up your organizer profile to start creating and managing events.
				</p>
			</div>
			<OrganizerRegistrationForm />
		</div>
	);
}
