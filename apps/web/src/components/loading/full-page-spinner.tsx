import { Spinner } from "@repo/ui/components/ui/spinner";
import { cn } from "@repo/ui/lib/utils";

interface FullPageSpinnerProps {
	label?: string;
	className?: string;
}

export function FullPageSpinner({ label, className }: FullPageSpinnerProps) {
	return (
		<div
			className={cn(
				"flex min-h-[50vh] flex-col items-center justify-center",
				className,
			)}
		>
			<Spinner className="size-8" />
			{label && <span className="sr-only">{label}</span>}
		</div>
	);
}
