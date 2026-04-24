import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";

interface PageSkeletonProps {
	variant?: "default" | "detail" | "dashboard";
	className?: string;
}

function DefaultSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-8 w-1/3" />
			<div className="space-y-3">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
			</div>
		</div>
	);
}

function DetailSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="aspect-video w-full rounded-lg" />
			<Skeleton className="h-8 w-2/3" />
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div className="space-y-3">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</div>
				<div className="space-y-3">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</div>
			</div>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<Skeleton className="h-24 rounded-xl" />
				<Skeleton className="h-24 rounded-xl" />
				<Skeleton className="h-24 rounded-xl" />
			</div>
			<Skeleton className="h-64 w-full rounded-xl" />
		</div>
	);
}

export function PageSkeleton({ variant = "default", className }: PageSkeletonProps) {
	return (
		<div aria-hidden="true" className={cn("p-4 md:p-6", className)}>
			{variant === "default" && <DefaultSkeleton />}
			{variant === "detail" && <DetailSkeleton />}
			{variant === "dashboard" && <DashboardSkeleton />}
		</div>
	);
}
