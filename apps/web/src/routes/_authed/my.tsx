import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarInset } from "@repo/ui/components/ui/sidebar";
import { AuthedSidebar } from "#/components/layout/authed-sidebar";
import { AuthedHeader } from "#/components/layout/authed-header";

export const Route = createFileRoute("/_authed/my")({
	component: ParticipantLayout,
});

function ParticipantLayout() {
	const { user } = Route.useRouteContext();
	return (
		<>
			<AuthedSidebar area="my" user={user} />
			<SidebarInset>
				<AuthedHeader area="my" />
				<main className="flex-1 p-4 md:p-6">
					<Outlet />
				</main>
			</SidebarInset>
		</>
	);
}
