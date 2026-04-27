/**
 * Recipe: Animated Numerals (`@number-flow/react`)
 *
 * Three production patterns used across EventKart:
 *   1. INR currency formatted with en-IN locale (lakh/crore grouping).
 *   2. Plain unit count ("1,247 attendees").
 *   3. Percentage delta whose color shifts between success/danger on change.
 *
 * Spring tuning is sourced from CSS tokens
 * (`--num-tabular-spring-stiffness`, `--num-tabular-spring-damping`) injected
 * via inline style so theme designers can retune motion globally.
 *
 * Common mistakes:
 *  - ❌ Wrapping `<NumberFlow>` in a layout-shift-prone parent → use
 *    `tabular-nums` on the container.
 *  - ❌ Forgetting reduced-motion. We pass `animated={false}` when the user
 *    has requested less motion.
 */

import NumberFlow from "@number-flow/react";
import { cn } from "@repo/ui/lib/utils";
import { useEffect, useState } from "react";

function usePrefersReducedMotion() {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mql.matches);
		const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);
	return reduced;
}

const springStyle: React.CSSProperties = {
	// Read by NumberFlow via custom CSS; tokens live in the global theme.
	["--number-flow-mass" as string]: "var(--num-tabular-spring-mass)",
	["--number-flow-stiffness" as string]: "var(--num-tabular-spring-stiffness)",
	["--number-flow-damping" as string]: "var(--num-tabular-spring-damping)",
};

export function CurrencyINR({ value }: { value: number }) {
	const reduced = usePrefersReducedMotion();
	return (
		<span className="tabular-nums" style={springStyle}>
			<NumberFlow
				value={value}
				locales="en-IN"
				format={{ style: "currency", currency: "INR", maximumFractionDigits: 0 }}
				animated={!reduced}
			/>
		</span>
	);
}

export function AttendeeCount({ value }: { value: number }) {
	const reduced = usePrefersReducedMotion();
	return (
		<span className="tabular-nums" style={springStyle}>
			<NumberFlow value={value} locales="en-IN" animated={!reduced} />
			<span className="ml-1 text-muted-foreground">attendees</span>
		</span>
	);
}

export function DeltaPercent({ value }: { value: number }) {
	const reduced = usePrefersReducedMotion();
	const tone =
		value > 0
			? "text-[color:var(--success)]"
			: value < 0
				? "text-[color:var(--danger)]"
				: "text-muted-foreground";

	return (
		<span className={cn("tabular-nums transition-colors", tone)} style={springStyle}>
			<NumberFlow
				value={value / 100}
				format={{ style: "percent", maximumFractionDigits: 1, signDisplay: "always" }}
				animated={!reduced}
			/>
		</span>
	);
}

export function AnimatedNumeralsDemo() {
	const [revenue, setRevenue] = useState(1_284_500);
	const [att, setAtt] = useState(1247);
	const [delta, setDelta] = useState(12.4);

	return (
		<div className="grid gap-6 p-6">
			<div className="text-3xl font-semibold"><CurrencyINR value={revenue} /></div>
			<div className="text-xl"><AttendeeCount value={att} /></div>
			<div className="text-xl"><DeltaPercent value={delta} /></div>

			<div className="flex gap-2">
				<button type="button" className="rounded border px-3 py-1" onClick={() => setRevenue((v) => v + 12_345)}>+ revenue</button>
				<button type="button" className="rounded border px-3 py-1" onClick={() => setAtt((v) => v + 17)}>+ attendees</button>
				<button type="button" className="rounded border px-3 py-1" onClick={() => setDelta((v) => -v)}>flip delta</button>
			</div>
		</div>
	);
}
