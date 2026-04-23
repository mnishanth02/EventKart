import { cn } from "@repo/ui/lib/utils";

export function RouteLoading({ className }: { className?: string }) {
	return (
		<div
			role="progressbar"
			aria-label="Loading page"
			aria-valuemin={0}
			aria-valuemax={100}
			className={cn("fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-muted", className)}
		>
			<div className="h-full w-full animate-[route-loading_1.5s_ease-in-out_infinite] bg-primary" />
		</div>
	);
}
