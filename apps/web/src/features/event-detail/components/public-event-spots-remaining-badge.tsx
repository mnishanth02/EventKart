import { publicEnv } from "#/lib/env/public";
import { Badge } from "@repo/ui/components/ui/badge";
import { Ban, Users } from "lucide-react";
import type { RegistrationState } from "../registration";
import { getSpotsRemainingDisplay } from "../spots-remaining";
import type { EventPublicCategory } from "../types";

export interface PublicEventSpotsRemainingBadgeProps {
	category: EventPublicCategory;
	state: RegistrationState;
	surface: "desktop" | "mobile";
}

export function PublicEventSpotsRemainingBadge({
	category,
	state,
	surface,
}: PublicEventSpotsRemainingBadgeProps) {
	if (publicEnv.VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED !== true) {
		return null;
	}

	const display = getSpotsRemainingDisplay(category, state);
	if (display === null) {
		return null;
	}

	if (display.kind === "sold-out") {
		return (
			<Badge
				variant="destructive"
				data-testid="spots-remaining-badge"
				data-category-slug={category.slug}
				data-surface={surface}
			>
				<Ban aria-hidden="true" />
				<span>Sold out</span>
			</Badge>
		);
	}

	return (
		<Badge
			variant="outline"
			className="border-amber-500/40 text-amber-700 dark:text-amber-400"
			data-testid="spots-remaining-badge"
			data-category-slug={category.slug}
			data-surface={surface}
		>
			<Users aria-hidden="true" />
			<span>{display.label}</span>
		</Badge>
	);
}
