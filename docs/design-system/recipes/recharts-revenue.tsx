/**
 * Recipe: Daily Revenue Line Chart (shadcn ChartContainer + Recharts)
 *
 * Renders a 30-day revenue trend with:
 *   - Palette mapped via `--chart-1..5` CSS custom properties (theme-aware).
 *   - INR-locale tooltip formatting (en-IN, lakh/crore grouping).
 *   - `ReferenceLine` for the daily revenue target.
 *   - SSR-safe sizing: a fixed-dimension `<LineChart>` rather than
 *     `<ResponsiveContainer>` (which measures the DOM and flashes empty on
 *     first paint under TanStack Start streaming SSR).
 *   - `isAnimationActive` honors `prefers-reduced-motion`.
 *
 * Common mistakes:
 *  - ❌ Using `ResponsiveContainer` inside an SSR shell that hasn't measured
 *    yet — produces 0×0 charts. Pass explicit width/height or use a
 *    container-query wrapper.
 *  - ❌ Hard-coded stroke colors prevent theme swaps. Always reference
 *    `var(--chart-N)`.
 */

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@repo/ui/components/ui/chart";
import { useEffect, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";

type Point = { day: string; revenue: number };

const data: Point[] = Array.from({ length: 30 }, (_, i) => {
	const d = new Date();
	d.setDate(d.getDate() - (29 - i));
	const base = 80_000 + Math.sin(i / 3) * 18_000 + i * 1_400;
	return { day: d.toISOString().slice(0, 10), revenue: Math.round(base) };
});

const DAILY_TARGET = 110_000;

const inr = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

const config = {
	revenue: { label: "Revenue", color: "var(--chart-1)" },
	target: { label: "Target", color: "var(--chart-3)" },
} satisfies ChartConfig;

function usePrefersReducedMotion() {
	const [r, setR] = useState(false);
	useEffect(() => {
		const m = window.matchMedia("(prefers-reduced-motion: reduce)");
		setR(m.matches);
		const fn = (e: MediaQueryListEvent) => setR(e.matches);
		m.addEventListener("change", fn);
		return () => m.removeEventListener("change", fn);
	}, []);
	return r;
}

export function RevenueLineChart({
	width = 720,
	height = 320,
}: {
	width?: number;
	height?: number;
}) {
	const reduced = usePrefersReducedMotion();

	return (
		<ChartContainer config={config} className="w-full">
			<LineChart width={width} height={height} data={data} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
				<CartesianGrid vertical={false} strokeDasharray="3 3" />
				<XAxis
					dataKey="day"
					tickLine={false}
					axisLine={false}
					tickFormatter={(v: string) => v.slice(5)}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					width={64}
					tickFormatter={(v: number) =>
						new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v)
					}
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent
							formatter={(value) => inr.format(Number(value))}
							labelFormatter={(label) =>
								new Date(String(label)).toLocaleDateString("en-IN", {
									weekday: "short",
									day: "numeric",
									month: "short",
								})
							}
						/>
					}
				/>
				<ReferenceLine
					y={DAILY_TARGET}
					stroke="var(--chart-3)"
					strokeDasharray="4 4"
					label={{ value: "Target", position: "right", fill: "var(--chart-3)" }}
				/>
				<Line
					type="monotone"
					dataKey="revenue"
					stroke="var(--chart-1)"
					strokeWidth={2.5}
					dot={false}
					isAnimationActive={!reduced}
					animationDuration={400}
				/>
			</LineChart>
		</ChartContainer>
	);
}
