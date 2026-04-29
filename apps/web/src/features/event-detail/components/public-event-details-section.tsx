import type { EventPublicDetail, EventPublicImage } from "../types";

export interface PublicEventDetailsSectionProps {
	event: EventPublicDetail;
}

export function PublicEventDetailsSection({
	event,
}: PublicEventDetailsSectionProps) {
	return (
		<section className="space-y-8 rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
			<div className="space-y-3">
				<h2 className="font-display text-2xl font-semibold tracking-tight">
					About this event
				</h2>
				<p className="whitespace-pre-line leading-7 text-muted-foreground">
					{event.description}
				</p>
			</div>
			<div className="space-y-3">
				<h2 className="font-display text-2xl font-semibold tracking-tight">
					Route
				</h2>
				<p className="whitespace-pre-line leading-7 text-muted-foreground">
					{event.routeDetails}
				</p>
				<RouteMapImage image={event.routeMapImage} title={event.title} />
			</div>
		</section>
	);
}

function RouteMapImage({
	image,
	title,
}: {
	image: EventPublicImage | null;
	title: string;
}) {
	if (!image) {
		return (
			<div
				aria-hidden="true"
				data-testid="route-map-placeholder"
				className="mt-5 aspect-video rounded-2xl border border-dashed bg-muted/50"
			/>
		);
	}

	return (
		<img
			src={image.url}
			alt={`Route map for ${title}`}
			className="mt-5 aspect-video w-full rounded-2xl border object-cover"
		/>
	);
}
