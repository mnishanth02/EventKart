import {
	EVENT_DISCOVERY_STATUS_LABELS,
	type EventDiscoveryStatus,
	getEventDiscoveryStatus,
} from "@repo/shared/utils";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent, CardFooter } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Ban, CalendarClock, Flag, Lock, Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { PublicEventPriceFrom } from "#/features/event-detail/components/public-event-price-from";
import { useNow } from "#/lib/hooks/use-now";
import {
	formatCardDateRange,
	formatCategoryList,
	formatLocation,
} from "../format";
import type { EventCardData } from "../types";

export interface PublicEventCardProps {
	event: EventCardData;
	className?: string;
}

const statusBadgeConfig: Record<
	EventDiscoveryStatus,
	{
		variant: "default" | "secondary" | "outline" | "destructive";
		Icon: ComponentType<SVGProps<SVGSVGElement>>;
	}
> = {
	registration_open: { variant: "default", Icon: Sparkles },
	upcoming: { variant: "secondary", Icon: CalendarClock },
	registration_closed: { variant: "outline", Icon: Lock },
	sold_out: { variant: "destructive", Icon: Ban },
	event_ended: { variant: "outline", Icon: Flag },
};

export function PublicEventCard({ event, className }: PublicEventCardProps) {
	const titleId = `event-card-${event.slug}-title`;
	const categories = formatCategoryList(event.categories);
	const status = useClientEventStatus(event);
	const priceIsUnavailable =
		event.isPaid && event.pricingTiers.length > 0 && status === null;
	const priceShouldBeDeemphasized =
		status === "sold_out" || status === "event_ended";

	return (
		<Link
			to="/events/$slug"
			params={{ slug: event.slug }}
			className={cn(
				"group block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				className,
			)}
		>
			<Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
				<article aria-labelledby={titleId} className="flex h-full flex-col">
					<HeroImage image={event.heroImage} title={event.title} />
					<CardContent className="flex flex-1 flex-col gap-4 p-4">
						<div className="flex min-h-6 justify-start">
							<StatusBadge status={status} />
						</div>
						<div className="space-y-3">
							<h3
								id={titleId}
								className="font-display text-lg font-semibold tracking-tight text-balance text-foreground"
							>
								{event.title}
							</h3>
							<EventMetaList event={event} categories={categories} />
						</div>
					</CardContent>
					<CardFooter className="mt-auto border-t p-4">
						<span
							className={cn(
								"min-h-5 text-sm font-medium text-foreground",
								priceShouldBeDeemphasized &&
									"text-muted-foreground line-through",
							)}
						>
							<Price event={event} hidden={priceIsUnavailable} />
						</span>
					</CardFooter>
				</article>
			</Card>
		</Link>
	);
}

function useClientEventStatus(
	event: EventCardData,
): EventDiscoveryStatus | null {
	const now = useNow();
	if (now === null) {
		return null;
	}
	return getEventDiscoveryStatus(event, now);
}

function StatusBadge({ status }: { status: EventDiscoveryStatus | null }) {
	if (status === null) {
		return (
			<span
				aria-hidden="true"
				data-testid="card-status-placeholder"
				className="invisible inline-flex rounded-full border px-2 py-0.5 text-xs font-medium"
			>
				Status
			</span>
		);
	}

	const { variant, Icon } = statusBadgeConfig[status];
	return (
		<Badge variant={variant} data-testid="card-status-badge">
			<Icon aria-hidden="true" />
			{EVENT_DISCOVERY_STATUS_LABELS[status]}
		</Badge>
	);
}

function HeroImage({
	image,
	title,
}: {
	image: EventCardData["heroImage"];
	title: string;
}) {
	if (image === null) {
		return (
			<div
				aria-hidden="true"
				data-testid="card-hero-placeholder"
				className="aspect-[16/10] w-full bg-[radial-gradient(circle_at_20%_20%,theme(colors.primary/0.18),transparent_32%),linear-gradient(135deg,theme(colors.muted),theme(colors.background))]"
			/>
		);
	}

	return (
		<img
			src={image.url}
			alt={title}
			loading="lazy"
			decoding="async"
			className="aspect-[16/10] w-full object-cover"
		/>
	);
}

function EventMetaList({
	event,
	categories,
}: {
	event: EventCardData;
	categories: string;
}) {
	return (
		<dl className="space-y-2 text-sm text-muted-foreground">
			<div>
				<dt className="sr-only">Date</dt>
				<dd>
					<time dateTime={event.startAt}>
						{formatCardDateRange(event.startAt, event.endAt, event.timezone)}
					</time>
				</dd>
			</div>
			<div>
				<dt className="sr-only">Location</dt>
				<dd>{formatLocation(event.city, event.venueName)}</dd>
			</div>
			{categories ? (
				<div>
					<dt className="sr-only">Categories</dt>
					<dd>{categories}</dd>
				</div>
			) : null}
		</dl>
	);
}

function Price({ event, hidden }: { event: EventCardData; hidden: boolean }) {
	if (!event.isPaid) {
		return <>Free</>;
	}
	if (event.pricingTiers.length === 0) {
		return <>Pricing TBA</>;
	}
	return (
		<span
			className={cn(hidden && "invisible")}
			aria-hidden={hidden || undefined}
		>
			<PublicEventPriceFrom tiers={event.pricingTiers} />
		</span>
	);
}
