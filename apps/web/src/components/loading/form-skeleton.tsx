import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";

interface FormSkeletonProps {
	fields?: number;
	className?: string;
}

export function FormSkeleton({ fields = 4, className }: FormSkeletonProps) {
	return (
		<div aria-hidden="true" className={cn("space-y-6", className)}>
			{Array.from({ length: fields }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders never reorder
				<div key={i} className="space-y-2">
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-10 w-full" />
				</div>
			))}
			<Skeleton className="h-10 w-32" />
		</div>
	);
}
