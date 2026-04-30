import { ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";
import { VERIFICATION_EXPLANATION } from "../lib/verification-copy";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "./ui/popover";

export type VerificationExplainerVariant = "inline-note" | "popover";

interface VerificationExplainerProps {
	/**
	 * `"inline-note"` (default): a small inline block paired with a
	 * shield icon. Used on the public organizer profile so that, once a
	 * visitor sees the verified badge, the meaning of "verified" is
	 * explained in-page (no extra click required).
	 *
	 * `"popover"`: an underlined trigger reading "What does verified
	 * mean?" that opens a compact popover with the same explanation.
	 * Used on the event-detail organizer card where vertical space is
	 * tight and the explainer should stay opt-in.
	 */
	variant?: VerificationExplainerVariant;
	/**
	 * Optional anchor id for the inline-note variant so callers can
	 * deep-link to the explanation (e.g. `#about-verification`).
	 * Ignored by the popover variant.
	 */
	id?: string;
	className?: string;
}

/**
 * Renders the canonical verification explainer copy
 * (`VERIFICATION_EXPLANATION`) in one of two surfaces.
 *
 * The component is the only authorized way to render the verification
 * explanation so that the wording — which describes verification as an
 * onboarding/policy check, NOT a guarantee of event quality or safety
 * (per `docs/requirements.md` §4.1) — stays in lockstep across every
 * surface.
 *
 * Sibling of `verified-badge.tsx`. Always render alongside (or near) a
 * `<VerifiedBadge />`; do not render this component when the organizer
 * is not verified.
 */
export function VerificationExplainer({
	variant = "inline-note",
	id,
	className,
}: VerificationExplainerProps) {
	if (variant === "popover") {
		return (
			<Popover>
				<PopoverTrigger
					className={cn(
						"inline-flex cursor-pointer items-center text-muted-foreground text-xs underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
						className,
					)}
				>
					{VERIFICATION_EXPLANATION.triggerLabel}
				</PopoverTrigger>
				<PopoverContent className="max-w-xs space-y-1 text-xs" align="start">
					<p className="font-semibold text-foreground text-sm">
						{VERIFICATION_EXPLANATION.heading}
					</p>
					<p className="text-muted-foreground leading-5">
						{VERIFICATION_EXPLANATION.body}
					</p>
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<div
			id={id}
			className={cn(
				"flex items-start gap-2 rounded-md border border-border/50 bg-muted/40 p-3 text-muted-foreground text-xs",
				className,
			)}
		>
			<ShieldCheck
				aria-hidden="true"
				className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
			/>
			<div className="space-y-1">
				<p className="font-semibold text-foreground">
					{VERIFICATION_EXPLANATION.heading}
				</p>
				<p className="leading-5">{VERIFICATION_EXPLANATION.body}</p>
			</div>
		</div>
	);
}
