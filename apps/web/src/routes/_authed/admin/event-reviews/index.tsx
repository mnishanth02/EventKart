import { createFileRoute } from "@tanstack/react-router";
import { EventReviewQueue } from "#/features/admin/components/event-review-queue";

export const Route = createFileRoute("/_authed/admin/event-reviews/")({
	component: EventReviewsPage,
	ssr: "data-only",
});

function EventReviewsPage() {
	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Event Reviews</h1>
			<EventReviewQueue />
		</div>
	);
}
