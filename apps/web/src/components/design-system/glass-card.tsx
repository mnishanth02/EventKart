/**
 * GlassSurface — frosted-glass surface in three tiers.
 *
 *   Tier 1 — Navigation surfaces (sticky header, sidebar). Subtle blur.
 *   Tier 2 — Hero overlays atop event imagery. Heavier blur + must pair
 *            with a scrim (e.g. `bg-gradient-to-t from-black/60 ...`)
 *            so text reaches AA contrast.
 *   Tier 3 — Modal / sheet grade (booking confirmation, command palette).
 *
 * Tokens come from the design system: `--glass-{1|2|3}-{blur,bg,border}`.
 *
 * a11y: Tier 2 over arbitrary media MUST have a scrim. Verify text contrast
 * against the worst-case pixel of the underlying media, not the glass alone.
 */

import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

export type GlassTier = 1 | 2 | 3;

export interface GlassSurfaceProps
	extends React.HTMLAttributes<HTMLDivElement> {
	tier: GlassTier;
}

export function GlassSurface({
	tier,
	className,
	style,
	children,
	...props
}: GlassSurfaceProps) {
	const glassStyle: React.CSSProperties = {
		background: `var(--glass-${tier}-bg)`,
		backdropFilter: `blur(var(--glass-${tier}-blur))`,
		WebkitBackdropFilter: `blur(var(--glass-${tier}-blur))`,
		borderColor: `var(--glass-${tier}-border)`,
		...style,
	};
	return (
		<div
			data-glass-tier={tier}
			className={cn("rounded-2xl border", className)}
			style={glassStyle}
			{...props}
		>
			{children}
		</div>
	);
}
