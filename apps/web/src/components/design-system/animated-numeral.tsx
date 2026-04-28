/**
 * Animated numerals (NumberFlow) — EventKart design-system primitive.
 *
 * Three production variants:
 *   - <CurrencyINR value={paise} />   Renders rupees (en-IN, lakh/crore grouping).
 *   - <AttendeeCount value={n} />     Plain unit count with "attendees" suffix.
 *   - <DeltaPercent value={pct} />    Percentage delta, color shifts on sign.
 *
 * Motion: NumberFlow controls timing via the `transformTiming` /
 * `spinTiming` props (Web Animations `EffectTiming` objects), NOT via CSS
 * variables. We therefore hard-wire a snappy ease-out that mirrors the
 * perceived feel of the design-system `--motion-spring-snappy-*` tokens.
 * If you retune those tokens, also retune `SNAPPY_TIMING` here.
 *
 * Reduced-motion: when the OS reports `prefers-reduced-motion: reduce`
 * we pass `animated={false}` to NumberFlow so the digit just snaps.
 *
 * IMPORTANT: <CurrencyINR> takes the value in PAISE (matches the API contract
 * across the codebase — see EVENT_PRICING_*_PAISE) and divides by 100 internally.
 */

import NumberFlow from "@number-flow/react";
import { cn } from "@repo/ui/lib/utils";
import * as React from "react";

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = React.useState(false);
	React.useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mql.matches);
		const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);
	return reduced;
}

// Approximates the `--motion-spring-snappy-*` token (mass 1 / stiffness 260 /
// damping 26 settles in ≈400 ms). NumberFlow doesn't read CSS vars for
// timing, so we pass an EffectTiming via props.
const SNAPPY_TIMING: EffectTiming = {
	duration: 400,
	easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

export interface CurrencyINRProps {
	/** Amount in paise (integer). Divided by 100 internally. */
	value: number;
	className?: string;
}

export function CurrencyINR({ value, className }: CurrencyINRProps) {
	const reduced = usePrefersReducedMotion();
	return (
		<span className={cn("tabular-nums", className)}>
			<NumberFlow
				value={value / 100}
				locales="en-IN"
				format={{
					style: "currency",
					currency: "INR",
					maximumFractionDigits: 0,
				}}
				transformTiming={SNAPPY_TIMING}
				spinTiming={SNAPPY_TIMING}
				animated={!reduced}
			/>
		</span>
	);
}

export interface AttendeeCountProps {
	value: number;
	className?: string;
	/** Override the trailing label (default: "attendees"). */
	label?: string;
}

export function AttendeeCount({
	value,
	className,
	label = "attendees",
}: AttendeeCountProps) {
	const reduced = usePrefersReducedMotion();
	return (
		<span className={cn("tabular-nums", className)}>
			<NumberFlow
				value={value}
				locales="en-IN"
				transformTiming={SNAPPY_TIMING}
				spinTiming={SNAPPY_TIMING}
				animated={!reduced}
			/>
			<span className="ml-1 text-muted-foreground">{label}</span>
		</span>
	);
}

export interface DeltaPercentProps {
	/** Percentage value (e.g. 12.4 means +12.4%). */
	value: number;
	className?: string;
}

export function DeltaPercent({ value, className }: DeltaPercentProps) {
	const reduced = usePrefersReducedMotion();
	const tone =
		value > 0
			? "text-success"
			: value < 0
				? "text-destructive"
				: "text-muted-foreground";

	return (
		<span className={cn("tabular-nums transition-colors", tone, className)}>
			<NumberFlow
				value={value / 100}
				format={{
					style: "percent",
					maximumFractionDigits: 1,
					signDisplay: "always",
				}}
				transformTiming={SNAPPY_TIMING}
				spinTiming={SNAPPY_TIMING}
				animated={!reduced}
			/>
		</span>
	);
}
