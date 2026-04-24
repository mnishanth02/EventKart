import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { getCurrentUser } from "#/lib/auth/server-fns";
import { FullPageSpinner } from "#/components/loading";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => {
		const user = await getCurrentUser();
		if (!user) {
			throw redirect({ to: "/", search: { reason: "auth-required" } });
		}
		return { user };
	},
	component: AuthedLayout,
	pendingComponent: () => <FullPageSpinner label="Checking authentication" />,
});

function AuthedLayout() {
	return (
		<SidebarProvider>
			<Outlet />
		</SidebarProvider>
	);
}
