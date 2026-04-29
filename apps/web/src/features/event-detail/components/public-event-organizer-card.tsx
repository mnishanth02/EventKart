import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { VerifiedBadge } from "@repo/ui/components/verified-badge";
import type { EventPublicOrganizerSummary } from "../types";

export interface PublicEventOrganizerCardProps {
	organizer: EventPublicOrganizerSummary;
}

export function PublicEventOrganizerCard({
	organizer,
}: PublicEventOrganizerCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>About the organizer</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 text-sm">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-semibold text-base text-foreground">
						{organizer.businessName}
					</p>
					{organizer.isVerified === true ? (
						<VerifiedBadge variant="inline" />
					) : null}
				</div>
				<p className="text-muted-foreground text-sm">
					Based in {organizer.city}
				</p>
				{organizer.description !== null ? (
					<p className="whitespace-pre-line text-muted-foreground text-sm leading-6">
						{organizer.description}
					</p>
				) : null}
				{/* TODO(I-2.3.1): swap to <Link to="/organizers/$slug" params={{ slug: organizer.slug }}> once the route exists. */}
				<a
					aria-label={`View profile of ${organizer.businessName}`}
					className="inline-flex items-center font-medium text-primary text-sm hover:underline"
					href={`/organizers/${organizer.slug}`}
				>
					View organizer profile →
				</a>
			</CardContent>
		</Card>
	);
}
