import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
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
				<CardTitle>Organizer</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 text-sm leading-6">
				<p className="text-muted-foreground">
					Organized by{" "}
					<strong className="text-foreground">{organizer.businessName}</strong>{" "}
					· {organizer.city}
				</p>
				{organizer.isVerified ? (
					<p className="text-xs font-medium text-muted-foreground">
						Verified organizer
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
