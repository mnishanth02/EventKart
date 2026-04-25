import { hasMinimumRole } from "@repo/shared/constants/roles";
import { SidebarInset } from "@repo/ui/components/ui/sidebar";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthedHeader } from "#/components/layout/authed-header";
import { AuthedSidebar } from "#/components/layout/authed-sidebar";

export const Route = createFileRoute("/_authed/org")({
	beforeLoad: ({ context }) => {
		if (!hasMinimumRole(context.user.role, "organizer")) {
			throw redirect({ to: "/", search: { reason: "forbidden" } });
		}
	},
	component: OrganizerLayout,
});

function OrganizerLayout() {
	const { user } = Route.useRouteContext();
	return (
		<>
			<AuthedSidebar area="org" user={user} />
			<SidebarInset>
				<AuthedHeader area="org" />
				<main className="flex-1 p-4 md:p-6">
					<Outlet />
				</main>
			</SidebarInset>
		</>
	);
}
