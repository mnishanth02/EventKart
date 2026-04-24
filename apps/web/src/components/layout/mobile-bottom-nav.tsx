import { Link } from "@tanstack/react-router";
import { CompassIcon, SearchIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

function MobileBottomNav() {
	return (
		<nav
			className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:hidden"
			aria-label="Mobile navigation"
		>
			<div className="flex h-14 items-stretch justify-around">
				<MobileNavItem
					to="/"
					icon={<CompassIcon className="size-5" />}
					label="Discover"
				/>
				<MobileNavItem
					to="/"
					icon={<SearchIcon className="size-5" />}
					label="Search"
					disabled
				/>
			</div>
		</nav>
	);
}

function MobileNavItem({
	to,
	icon,
	label,
	disabled,
}: {
	to: string;
	icon: React.ReactNode;
	label: string;
	disabled?: boolean;
}) {
	return (
		<Link
			to={to}
			disabled={disabled}
			activeOptions={{ exact: true }}
			className={cn(
				"relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium no-underline transition-colors",
				disabled
					? "text-muted-foreground/50 pointer-events-none"
					: "text-muted-foreground hover:text-foreground",
			)}
			activeProps={{
				className: cn(
					"relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium no-underline transition-colors text-primary",
				),
			}}
		>
			{({ isActive }) => (
				<>
					{isActive && !disabled && (
						<span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
					)}
					{icon}
					<span>{label}</span>
				</>
			)}
		</Link>
	);
}

export { MobileBottomNav };
