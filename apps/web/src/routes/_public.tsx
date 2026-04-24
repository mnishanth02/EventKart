import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PublicHeader } from "#/components/layout/public-header";
import { PublicFooter } from "#/components/layout/public-footer";
import { MobileBottomNav } from "#/components/layout/mobile-bottom-nav";

export const Route = createFileRoute("/_public")({
	component: PublicLayout,
});

function PublicLayout() {
	return (
		<div className="flex min-h-screen flex-col">
			<PublicHeader />

			{/* Main content — offset for fixed header and mobile bottom nav */}
			<main className="flex-1 pt-14 pb-16 md:pt-16 md:pb-0">
				<Outlet />
			</main>

			<PublicFooter />
			<MobileBottomNav />
		</div>
	);
}
