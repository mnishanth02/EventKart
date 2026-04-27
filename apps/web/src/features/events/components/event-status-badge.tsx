import { EVENT_STATUS_LABELS, type EventStatus } from "@repo/shared/constants";
import { Badge } from "@repo/ui/components/ui/badge";

const statusVariant: Record<EventStatus, "default" | "secondary" | "outline"> = {
	draft: "secondary",
	under_review: "outline",
	published: "default",
	completed: "secondary",
	cancelled: "outline",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
	return (
		<Badge variant={statusVariant[status]} aria-label={`Event status ${EVENT_STATUS_LABELS[status]}`}>
			{EVENT_STATUS_LABELS[status]}
		</Badge>
	);
}
