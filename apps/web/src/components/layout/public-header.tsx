import { hasMinimumRole } from "@repo/shared/constants/roles";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";
import { Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import * as React from "react";
import { useAuth, useRequireAuth } from "#/features/auth/hooks";
import { GlassSurface } from "@/components/design-system";

function PublicHeader() {
	const [scrolled, setScrolled] = React.useState(false);
	const navigate = useNavigate();
	const { session } = useAuth();
	const { requireAuth, loginDialog } = useRequireAuth();

	React.useEffect(() => {
		setScrolled(window.scrollY > 16);

		let ticking = false;
		function onScroll() {
			if (!ticking) {
				ticking = true;
				requestAnimationFrame(() => {
					setScrolled(window.scrollY > 16);
					ticking = false;
				});
			}
		}

		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	function handleOrganizerClick() {
		requireAuth(() => {
			const target =
				session && hasMinimumRole(session.role, "organizer")
					? "/org"
					: "/org/register";
			void navigate({ to: target });
		});
	}

	return (
		<>
			<header className="fixed inset-x-0 top-0 z-50 h-14 transition-all duration-300 md:h-16">
				{scrolled && (
					<GlassSurface
						tier={1}
						className="absolute inset-0 rounded-none border-x-0 border-t-0"
						aria-hidden
					/>
				)}
				<div className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
					{/* Logo */}
					<Link
						to="/"
						className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground no-underline"
					>
						<span className="font-display">eventKart</span>
					</Link>

					{/* Desktop nav links */}
					<nav className="hidden items-center gap-1 md:flex" aria-label="Main">
						<NavLink to="/" label="Discover" />
					</nav>

					{/* Right actions */}
					<div className="flex items-center gap-1">
						<button
							type="button"
							disabled
							aria-label="Search events (coming soon)"
							className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:hidden"
						>
							<SearchIcon className="size-[18px]" />
						</button>

						<ThemeToggle />

						<button
							type="button"
							onClick={handleOrganizerClick}
							className="ml-2 hidden rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-accent md:inline-flex"
						>
							For Organizers
						</button>
					</div>
				</div>
			</header>
			{loginDialog}
		</>
	);
}

function NavLink({ to, label }: { to: string; label: string }) {
	return (
		<Link
			to={to}
			activeOptions={{ exact: true }}
			className="chalk-underline px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground no-underline"
			activeProps={{
				className:
					"chalk-underline is-active px-3 py-2 text-sm font-medium text-foreground no-underline",
			}}
		>
			{label}
		</Link>
	);
}

export { PublicHeader };
