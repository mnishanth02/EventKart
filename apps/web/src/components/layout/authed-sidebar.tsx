import { Badge } from "@repo/ui/components/ui/badge";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@repo/ui/components/ui/sidebar";
import { Link, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	BuildingIcon,
	CalendarPlusIcon,
	ClipboardCheckIcon,
	FileCheckIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	ShieldIcon,
	UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthActions } from "#/features/auth/hooks";
import { apiClient } from "#/lib/api-client";
import type { AuthSession } from "#/lib/auth/server-fns";

// ── Navigation Config ──────────────────────────────────────────────

type NavItem = {
	label: string;
	href: string;
	icon: LucideIcon;
};

const NAV_ITEMS: Record<Area, NavItem[]> = {
	my: [{ label: "Dashboard", href: "/my", icon: LayoutDashboardIcon }],
	org: [
		{ label: "Dashboard", href: "/org", icon: LayoutDashboardIcon },
		{ label: "Create Event", href: "/org/events/new", icon: CalendarPlusIcon },
		{ label: "Profile", href: "/org/profile", icon: UserIcon },
		{ label: "Policies", href: "/org/policies", icon: FileCheckIcon },
		{
			label: "Verification",
			href: "/org/verification",
			icon: ClipboardCheckIcon,
		},
	],
	admin: [
		{ label: "Dashboard", href: "/admin", icon: LayoutDashboardIcon },
		{
			label: "Verifications",
			href: "/admin/verifications",
			icon: ClipboardCheckIcon,
		},
	],
};

const AREA_CONFIG: Record<Area, { label: string; icon: LucideIcon }> = {
	my: { label: "My Account", icon: UserIcon },
	org: { label: "Organizer", icon: BuildingIcon },
	admin: { label: "Admin", icon: ShieldIcon },
};

// ── Types ──────────────────────────────────────────────────────────

type Area = "my" | "org" | "admin";

interface AuthedSidebarProps {
	area: Area;
	user: AuthSession;
}

// ── Component ──────────────────────────────────────────────────────

function AuthedSidebar({ area, user }: AuthedSidebarProps) {
	const navigate = useNavigate();
	const { clearSession, invalidateSession } = useAuthActions();
	const areaConfig = AREA_CONFIG[area];
	const navItems = NAV_ITEMS[area];

	async function handleLogout() {
		try {
			await apiClient("/auth/logout", { method: "POST" });
			invalidateSession();
		} catch {
			// API failed — clear local cache so UI reflects logged-out state,
			// but warn the user that the server session may persist.
			clearSession();
			toast.error(
				"Logout may not have completed. Please close your browser if issues persist.",
			);
		}
		void navigate({ to: "/" });
	}

	return (
		<Sidebar>
			<SidebarHeader className="border-b p-4">
				<Link to="/" className="flex items-center gap-2 font-semibold">
					<areaConfig.icon className="size-5" />
					<span>eventKart</span>
				</Link>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>{areaConfig.label}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton asChild>
										<Link to={item.href}>
											<item.icon className="size-4" />
											<span>{item.label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="border-t p-4">
				<div className="flex items-center justify-between">
					<Badge variant="secondary" className="text-xs">
						{user.role}
					</Badge>
					<button
						type="button"
						onClick={handleLogout}
						className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						<LogOutIcon className="size-3.5" />
						<span>Logout</span>
					</button>
				</div>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}

export type { AuthedSidebarProps };
export { AuthedSidebar };
