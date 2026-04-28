/**
 * Design-system primitives for apps/web.
 *
 * These are app-level composites built on top of the shared shadcn primitives
 * in `@repo/ui`. Anything that is NOT a generic shadcn component lives here
 * (or in a feature module under `apps/web/src/features/<domain>/components/`).
 *
 * Before adding a new component here:
 *   1. Check `packages/ui/src/components/ui/` for a shadcn primitive that
 *      already covers the need.
 *   2. Check this folder for an existing app-level primitive.
 *   3. Check the relevant feature module under `apps/web/src/features/`.
 *   4. Only then create a new file.
 */

export {
	AttendeeCount,
	type AttendeeCountProps,
	CurrencyINR,
	type CurrencyINRProps,
	DeltaPercent,
	type DeltaPercentProps,
} from "./animated-numeral";
export { BentoGrid, type BentoGridProps } from "./bento-grid";
export {
	GlassSurface,
	type GlassSurfaceProps,
	type GlassTier,
} from "./glass-card";
export {
	type ToastRetryOptions,
	type ToastUndoOptions,
	toastPromise,
	toastRetry,
	toastUndo,
} from "./toast-helpers";
