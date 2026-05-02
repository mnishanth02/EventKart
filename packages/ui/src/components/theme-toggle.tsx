"use client";

import { cn } from "@ui/lib/utils";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

function ThemeToggle({ className }: { className?: string }) {
	const [mounted, setMounted] = React.useState(false);
	const { setTheme, resolvedTheme } = useTheme();

	React.useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<button
			type="button"
			aria-label={
				mounted
					? `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`
					: "Toggle theme"
			}
			className={cn(
				"inline-flex size-9 items-center justify-center rounded-md border border-border/60 bg-background/40 text-foreground shadow-xs backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				className,
			)}
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
		>
			{mounted ? (
				resolvedTheme === "dark" ? (
					<SunIcon className="size-[18px]" />
				) : (
					<MoonIcon className="size-[18px]" />
				)
			) : (
				<span className="size-[18px]" />
			)}
		</button>
	);
}

export { ThemeToggle };
