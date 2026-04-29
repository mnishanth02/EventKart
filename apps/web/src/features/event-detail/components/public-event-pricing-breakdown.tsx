import { CurrencyINR } from "#/components/design-system";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { useNow } from "../hooks";
import { getEarlyBirdStatus } from "../pricing";
import type {
	EventPublicCategory,
	EventPublicDetail,
	EventPublicPricingTier,
} from "../types";

export interface PublicEventPricingBreakdownProps {
	event: EventPublicDetail;
}

export function PublicEventPricingBreakdown({
	event,
}: PublicEventPricingBreakdownProps) {
	const rows = getBreakdownRows(event.categories, event.pricingTiers);
	const hasEarlyBird = rows.some(
		(row) => row.tier?.earlyBirdPrice != null,
	);
	const now = useNow();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Categories &amp; pricing</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="hidden overflow-hidden rounded-xl border sm:block">
					<table className="w-full text-sm">
						<caption className="sr-only">
							Race categories with distance and registration pricing
						</caption>
						<thead className="bg-muted/60 text-left text-muted-foreground">
							<tr>
								<th scope="col" className="px-4 py-3 font-medium">
									Category
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Distance
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Base price
								</th>
								{hasEarlyBird ? (
									<th scope="col" className="px-4 py-3 font-medium">
										Early bird
									</th>
								) : null}
							</tr>
						</thead>
						<tbody className="divide-y">
							{rows.map(({ category, tier }) => (
								<tr key={category.slug}>
									<th
										scope="row"
										className="px-4 py-3 text-left font-medium"
									>
										{category.name}
									</th>
									<td className="px-4 py-3 text-muted-foreground">
										{formatDistance(category.distanceMeters)}
									</td>
									<td className="px-4 py-3">
										{tier ? (
											<CurrencyINR value={tier.basePrice} />
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</td>
									{hasEarlyBird ? (
										<td className="px-4 py-3">
											<EarlyBirdCell
												tier={tier}
												timezone={event.timezone}
												now={now}
											/>
										</td>
									) : null}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<dl className="space-y-3 sm:hidden">
					{rows.map(({ category, tier }) => (
						<div
							key={category.slug}
							className="rounded-xl border bg-background p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<dt className="font-medium">{category.name}</dt>
								{tier ? (
									<dd>
										<CurrencyINR value={tier.basePrice} />
									</dd>
								) : (
									<dd className="text-muted-foreground">—</dd>
								)}
							</div>
							<dd className="mt-1 text-sm text-muted-foreground">
								{formatDistance(category.distanceMeters)}
							</dd>
							{tier?.earlyBirdPrice != null ? (
								<dd className="mt-2 text-sm">
									<EarlyBirdCell
										tier={tier}
										timezone={event.timezone}
										now={now}
									/>
								</dd>
							) : null}
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

interface EarlyBirdCellProps {
	tier: EventPublicPricingTier | undefined;
	timezone: string;
	now: Date | null;
}

function EarlyBirdCell({ tier, timezone, now }: EarlyBirdCellProps) {
	if (!tier || tier.earlyBirdPrice == null) {
		return <span className="text-muted-foreground">—</span>;
	}
	const status = now
		? getEarlyBirdStatus(tier, now)
		: ("none" as const);

	return (
		<div className="space-y-1">
			<div className="flex flex-wrap items-center gap-2">
				<CurrencyINR value={tier.earlyBirdPrice} />
				{status === "active" ? (
					<Badge variant="default">Active</Badge>
				) : null}
				{status === "expired" ? (
					<Badge variant="secondary">Expired</Badge>
				) : null}
			</div>
			{tier.earlyBirdDeadline ? (
				<p className="text-xs text-muted-foreground">
					Until {formatDeadline(tier.earlyBirdDeadline, timezone)}
				</p>
			) : null}
		</div>
	);
}

interface BreakdownRow {
	category: EventPublicCategory;
	tier: EventPublicPricingTier | undefined;
}

function getBreakdownRows(
	categories: ReadonlyArray<EventPublicCategory>,
	tiers: ReadonlyArray<EventPublicPricingTier>,
): BreakdownRow[] {
	const tierBySlug = new Map(
		tiers.map((tier) => [tier.categorySlug, tier]),
	);
	return [...categories]
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((category) => ({
			category,
			tier: tierBySlug.get(category.slug),
		}));
}

function formatDistance(distanceMeters: number): string {
	const fractionDigits = distanceMeters % 1000 === 0 ? 0 : 2;
	return `${(distanceMeters / 1000).toFixed(fractionDigits)} km`;
}

function formatDeadline(value: string, timezone: string): string {
	const date = new Date(value);
	try {
		return new Intl.DateTimeFormat("en-IN", {
			dateStyle: "medium",
			timeStyle: "short",
			timeZone: timezone,
		}).format(date);
	} catch {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(date);
	}
}
