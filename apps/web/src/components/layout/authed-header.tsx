import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";
import { Separator } from "@repo/ui/components/ui/separator";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";

// ── Types ──────────────────────────────────────────────────────────

type Area = "my" | "org" | "admin";

const AREA_LABELS: Record<Area, string> = {
	my: "My Account",
	org: "Organizer",
	admin: "Admin",
};

interface AuthedHeaderProps {
	area: Area;
}

// ── Component ──────────────────────────────────────────────────────

function AuthedHeader({ area }: AuthedHeaderProps) {
	return (
		<header className="sticky top-0 z-10 flex h-12 items-center border-b bg-background px-2">
			<SidebarTrigger />
			<Separator orientation="vertical" className="mx-2 !h-4" />
			<span className="text-sm font-medium">{AREA_LABELS[area]}</span>
			<div className="ml-auto">
				<ThemeToggle />
			</div>
		</header>
	);
}

export { AuthedHeader };
export type { AuthedHeaderProps };
