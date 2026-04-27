import { createFileRoute } from "@tanstack/react-router";
import { EventReviewDetail } from "#/features/admin/components/event-review-detail";

export const Route = createFileRoute("/_authed/admin/event-reviews/$eventId")({
	component: EventReviewPage,
	ssr: "data-only",
});

function EventReviewPage() {
	const { eventId } = Route.useParams();
	return <EventReviewDetail eventId={eventId} />;
}
