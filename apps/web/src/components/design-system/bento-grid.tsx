/**
 * BentoGrid — dashboard layout primitive.
 *
 * Establishes a container-query scope (`@container/bento`) and a CSS Grid
 * that collapses to a single column on narrow containers. Children control
 * their own `col-span-*` / `row-span-*` (using `@[48rem]/bento:` variants)
 * to participate in the bento layout.
 *
 * Why container queries instead of viewport queries: dashboards may be
 * embedded in side panels, modal sheets, or full-page shells of different
 * widths. Viewport queries would lie about the available space.
 *
 * Common mistakes:
 *  - ❌ Children using `lg:col-span-*` (viewport) instead of `@[48rem]/bento:`
 *    (container) — breaks when embedded in narrower shells.
 *  - ❌ Forgetting `min-h-0` on chart cards — recharts grows infinitely.
 */

import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

export interface BentoGridProps extends React.HTMLAttributes<HTMLElement> {
	/** Number of columns at the wide breakpoint (default 4). */
	columns?: 2 | 3 | 4 | 6;
}

const COLUMN_CLASSES: Record<NonNullable<BentoGridProps["columns"]>, string> = {
	2: "@[48rem]/bento:grid-cols-2",
	3: "@[48rem]/bento:grid-cols-3",
	4: "@[48rem]/bento:grid-cols-4",
	6: "@[48rem]/bento:grid-cols-6",
};

export function BentoGrid({
	columns = 4,
	className,
	children,
	...props
}: BentoGridProps) {
	return (
		<section className={cn("@container/bento w-full", className)} {...props}>
			<div
				className={cn(
					"grid grid-cols-1 gap-4",
					COLUMN_CLASSES[columns],
					"@[48rem]/bento:auto-rows-[minmax(0,1fr)]",
				)}
			>
				{children}
			</div>
		</section>
	);
}
