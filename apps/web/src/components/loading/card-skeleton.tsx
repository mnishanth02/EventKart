import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";

interface CardSkeletonProps {
	count?: number;
	className?: string;
}

export function CardSkeleton({ count = 3, className }: CardSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3",
				className,
			)}
		>
			{Array.from({ length: count }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders never reorder
				<div key={i} className="rounded-xl border border-border p-4 space-y-3">
					<Skeleton className="aspect-video w-full rounded-lg" />
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-5 w-3/4" />
					<Skeleton className="h-3 w-1/2" />
					<div className="flex justify-between">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-16" />
					</div>
				</div>
			))}
		</div>
	);
}
