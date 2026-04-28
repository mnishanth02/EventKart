/**
 * Recipe: KPI Card (numeral + trend + sparkline)
 *
 * Composite metric tile used across the organizer dashboard. Combines:
 *   - Animated numeral via `<NumberFlow>` (currency / count)
 *   - Trend arrow + percent delta with semantic color
 *   - Recharts sparkline (no axes, no tooltip)
 *   - Glass-1 background using `var(--glass-1-bg|blur|border)`
 *   - Density-aware padding via `useDensity()`
 *
 * Common mistakes:
 *  - ❌ Animating the sparkline on every prop change → flicker. We disable
 *    Recharts animation; NumberFlow handles motion.
 *  - ❌ Hard-coding green/red — use `--success` / `--danger` tokens so theme
 *    swaps follow.
 */

import NumberFlow from "@number-flow/react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useDensity } from "@repo/ui/hooks/use-density";
import { cn } from "@repo/ui/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Line, LineChart } from "recharts";

export type KPICardProps = {
	label: string;
	value: number;
	delta: number;
	sparklineData: number[];
	icon?: LucideIcon;
	span?: "feature" | "half" | "third" | "quarter";
	currency?: boolean;
	className?: string;
};

export function KPICard({
	label,
	value,
	delta,
	sparklineData,
	icon: Icon,
	span = "quarter",
	currency = false,
	className,
}: KPICardProps) {
	const density = useDensity();
	const padding = density === "compact" ? "p-3" : "p-5";

	const trendDir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
	const trendColor =
		trendDir === "up"
			? "text-[color:var(--success)]"
			: trendDir === "down"
				? "text-[color:var(--danger)]"
				: "text-muted-foreground";
	const TrendIcon =
		trendDir === "up" ? ArrowUpRight : trendDir === "down" ? ArrowDownRight : Minus;

	const data = sparklineData.map((v, i) => ({ i, v }));

	return (
		<article
			data-span={span}
			className={cn(
				"relative overflow-hidden rounded-2xl border",
				padding,
				className,
			)}
			style={{
				background: "var(--glass-1-bg)",
				backdropFilter: `blur(var(--glass-1-blur))`,
				borderColor: "var(--glass-1-border)",
			}}
		>
			<header className="flex items-center justify-between">
				<span className="text-sm text-muted-foreground">{label}</span>
				{Icon && <Icon className="size-4 text-muted-foreground" />}
			</header>

			<div className="mt-2 flex items-end justify-between gap-3">
				<div className="text-3xl font-semibold tabular-nums">
					<NumberFlow
						value={value}
						format={
							currency
								? { style: "currency", currency: "INR", maximumFractionDigits: 0 }
								: { notation: "standard" }
						}
						locales="en-IN"
					/>
				</div>
				<div className={cn("flex items-center gap-1 text-sm", trendColor)}>
					<TrendIcon className="size-4" />
					<NumberFlow value={delta} format={{ style: "percent", maximumFractionDigits: 1 }} />
				</div>
			</div>

			<div className="mt-3 h-10">
				<LineChart width={160} height={40} data={data}>
					<Line
						type="monotone"
						dataKey="v"
						stroke="var(--chart-1)"
						strokeWidth={2}
						dot={false}
						isAnimationActive={false}
					/>
				</LineChart>
			</div>
		</article>
	);
}

export function KPICardSkeleton() {
	return (
		<div className="rounded-2xl border p-5">
			<Skeleton className="h-4 w-24" />
			<Skeleton className="mt-3 h-8 w-32" />
			<Skeleton className="mt-3 h-10 w-full" />
		</div>
	);
}
