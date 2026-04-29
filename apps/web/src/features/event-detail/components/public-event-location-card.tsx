import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import type { EventPublicDetail } from "../types";

export interface PublicEventLocationCardProps {
	event: EventPublicDetail;
}

export function PublicEventLocationCard({
	event,
}: PublicEventLocationCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Location</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 text-sm">
				<address className="space-y-1 not-italic leading-6">
					<strong className="block text-base text-foreground">
						{event.venueName}
					</strong>
					<span className="block text-muted-foreground">
						{event.addressLine1}
					</span>
					{event.addressLine2 ? (
						<span className="block text-muted-foreground">
							{event.addressLine2}
						</span>
					) : null}
					<span className="block text-muted-foreground">
						{event.city}, {event.state}, {event.country}
					</span>
					{event.postalCode ? (
						<span className="block text-muted-foreground">
							{event.postalCode}
						</span>
					) : null}
				</address>
				<p className="text-xs text-muted-foreground">
					Timezone: {event.timezone}
				</p>
			</CardContent>
		</Card>
	);
}
