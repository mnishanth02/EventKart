import { ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";

interface VerifiedBadgeProps {
	variant?: "inline" | "badge";
	showLabel?: boolean;
	className?: string;
}

export function VerifiedBadge({
	variant = "badge",
	showLabel = true,
	className,
}: VerifiedBadgeProps) {
	if (variant === "inline") {
		return (
			<span
				role="img"
				className={cn(
					"inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400",
					className,
				)}
				aria-label="Verified organizer"
			>
				<ShieldCheck className="h-4 w-4" aria-hidden="true" />
				{showLabel && <span className="text-xs font-medium">Verified</span>}
			</span>
		);
	}

	return (
		<span
			role="img"
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
				className,
			)}
			aria-label="Verified organizer"
		>
			<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
			{showLabel && <span className="text-xs font-medium">Verified</span>}
		</span>
	);
}
