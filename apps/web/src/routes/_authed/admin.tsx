import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { hasMinimumRole } from "@repo/shared/constants/roles";
import { SidebarInset } from "@repo/ui/components/ui/sidebar";
import { AuthedSidebar } from "#/components/layout/authed-sidebar";
import { AuthedHeader } from "#/components/layout/authed-header";

export const Route = createFileRoute("/_authed/admin")({
	beforeLoad: ({ context }) => {
		if (!hasMinimumRole(context.user.role, "admin")) {
			throw redirect({ to: "/", search: { reason: "forbidden" } });
		}
	},
	component: AdminLayout,
});

function AdminLayout() {
	const { user } = Route.useRouteContext();
	return (
		<>
			<AuthedSidebar area="admin" user={user} />
			<SidebarInset>
				<AuthedHeader area="admin" />
				<main className="flex-1 p-4 md:p-6">
					<Outlet />
				</main>
			</SidebarInset>
		</>
	);
}
