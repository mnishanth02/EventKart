import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";

interface TableSkeletonProps {
	rows?: number;
	columns?: number;
	className?: string;
}

export function TableSkeleton({
	rows = 5,
	columns = 4,
	className,
}: TableSkeletonProps) {
	return (
		<div aria-hidden="true" className={cn("w-full space-y-2", className)}>
			{/* Header row */}
			<div className="flex gap-4 border-b border-border pb-2">
				{Array.from({ length: columns }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders never reorder
					<Skeleton key={i} className="h-4 flex-1" />
				))}
			</div>

			{/* Body rows */}
			{Array.from({ length: rows }, (_, rowIdx) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders never reorder
				<div key={rowIdx} className="flex gap-4 py-2">
					{Array.from({ length: columns }, (_, colIdx) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders never reorder
						<Skeleton key={colIdx} className="h-3 flex-1" />
					))}
				</div>
			))}
		</div>
	);
}
