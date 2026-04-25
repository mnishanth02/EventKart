import { ThemeToggle } from "@repo/ui/components/theme-toggle";
import { cn } from "@repo/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import * as React from "react";

function PublicHeader() {
	const [scrolled, setScrolled] = React.useState(false);

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

	return (
		<header
			className={cn(
				"fixed inset-x-0 top-0 z-50 h-14 transition-all duration-300 md:h-16",
				scrolled
					? "border-b border-border/50 bg-background/80 backdrop-blur-xl"
					: "bg-transparent",
			)}
		>
			<div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">
				{/* Logo */}
				<Link
					to="/"
					className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground no-underline"
				>
					<span className="display-title">eventKart</span>
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

					<Link
						to="/"
						className="ml-2 hidden rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-accent md:inline-flex"
					>
						For Organizers
					</Link>
				</div>
			</div>
		</header>
	);
}

function NavLink({ to, label }: { to: string; label: string }) {
	return (
		<Link
			to={to}
			activeOptions={{ exact: true }}
			className="nav-link px-3 py-2 text-sm font-medium"
			activeProps={{
				className: "nav-link px-3 py-2 text-sm font-medium is-active",
			}}
		>
			{label}
		</Link>
	);
}

export { PublicHeader };
