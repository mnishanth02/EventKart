import { Badge } from "@repo/ui/components/ui/badge";
import type { EventPublicDetail, EventPublicImage } from "../types";

export interface PublicEventHeroProps {
	event: EventPublicDetail;
}

export function PublicEventHero({ event }: PublicEventHeroProps) {
	return (
		<section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
			<HeroImage image={event.heroImage} title={event.title} />
			<div className="space-y-5 p-5 sm:p-8 lg:p-10">
				<div className="flex flex-wrap gap-2">
					<Badge variant="secondary" className="capitalize">
						{event.sport}
					</Badge>
					<Badge variant="outline" className="capitalize">
						{event.eventType}
					</Badge>
					<Badge variant="outline">
						{event.city}, {event.state}
					</Badge>
				</div>
				<div className="space-y-3">
					<h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
						{event.title}
					</h1>
					<p className="text-base text-muted-foreground sm:text-lg">
						<time dateTime={event.startAt}>{formatDateRange(event)}</time>
					</p>
				</div>
			</div>
		</section>
	);
}

function HeroImage({
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
				data-testid="hero-image-placeholder"
				className="aspect-video bg-[radial-gradient(circle_at_20%_20%,theme(colors.primary/0.18),transparent_32%),linear-gradient(135deg,theme(colors.muted),theme(colors.background))] lg:aspect-[21/9]"
			/>
		);
	}

	return (
		<img
			src={image.url}
			// biome-ignore lint/a11y/noRedundantAlt: Product copy requires this exact alt text for I-2.1.1.
			alt={`${title} event hero image`}
			className="aspect-video w-full object-cover lg:aspect-[21/9]"
		/>
	);
}

function formatDateRange(event: EventPublicDetail): string {
	const start = new Date(event.startAt);
	const end = new Date(event.endAt);
	try {
		const day = new Intl.DateTimeFormat("en-IN", {
			dateStyle: "full",
			timeZone: event.timezone,
		}).format(start);
		const time = new Intl.DateTimeFormat("en-IN", {
			timeStyle: "short",
			timeZone: event.timezone,
		}).formatRange(start, end);
		return `${day} · ${time}`;
	} catch {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "full",
			timeStyle: "short",
		}).formatRange(start, end);
	}
}
