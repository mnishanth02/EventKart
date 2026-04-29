import { CurrencyINR } from "#/components/design-system";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import type {
	EventPublicCategory,
	EventPublicDetail,
	EventPublicPricingTier,
} from "../types";

export interface PublicEventPricingTableProps {
	event: EventPublicDetail;
}

export function PublicEventPricingTable({
	event,
}: PublicEventPricingTableProps) {
	const rows = getPricingRows(event.categories, event.pricingTiers);
	const hasEarlyBird = rows.some((row) => row.tier.earlyBirdPrice !== null);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Pricing</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="hidden overflow-hidden rounded-xl border sm:block">
					<table className="w-full text-sm">
						<caption className="sr-only">
							Registration pricing by category
						</caption>
						<thead className="bg-muted/60 text-left text-muted-foreground">
							<tr>
								<th scope="col" className="px-4 py-3 font-medium">
									Category
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
								<tr key={tier.categorySlug}>
									<th scope="row" className="px-4 py-3 text-left font-medium">
										{category?.name ?? tier.categorySlug}
									</th>
									<td className="px-4 py-3">
										<CurrencyINR value={tier.basePrice} />
									</td>
									{hasEarlyBird ? (
										<td className="px-4 py-3">
											{tier.earlyBirdPrice !== null ? (
												<div className="space-y-1">
													<CurrencyINR value={tier.earlyBirdPrice} />
													{tier.earlyBirdDeadline ? (
														<p className="text-xs text-muted-foreground">
															Until{" "}
															{formatDeadline(
																tier.earlyBirdDeadline,
																event.timezone,
															)}
														</p>
													) : null}
												</div>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</td>
									) : null}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className="space-y-3 sm:hidden">
					{rows.map(({ category, tier }) => (
						<div
							key={tier.categorySlug}
							className="rounded-xl border bg-background p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<h3 className="font-medium">
									{category?.name ?? tier.categorySlug}
								</h3>
								<CurrencyINR value={tier.basePrice} />
							</div>
							{tier.earlyBirdPrice !== null ? (
								<p className="mt-2 text-sm text-muted-foreground">
									Early bird <CurrencyINR value={tier.earlyBirdPrice} />
									{tier.earlyBirdDeadline
										? ` until ${formatDeadline(tier.earlyBirdDeadline, event.timezone)}`
										: ""}
								</p>
							) : null}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function getPricingRows(
	categories: EventPublicCategory[],
	tiers: EventPublicPricingTier[],
) {
	const categoryBySlug = new Map(
		categories.map((category) => [category.slug, category]),
	);
	return [...tiers]
		.sort((a, b) => {
			const left =
				categoryBySlug.get(a.categorySlug)?.sortOrder ??
				Number.MAX_SAFE_INTEGER;
			const right =
				categoryBySlug.get(b.categorySlug)?.sortOrder ??
				Number.MAX_SAFE_INTEGER;
			return left - right;
		})
		.map((tier) => ({
			tier,
			category: categoryBySlug.get(tier.categorySlug),
		}));
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
