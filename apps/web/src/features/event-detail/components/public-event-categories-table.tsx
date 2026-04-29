import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import type { EventPublicCategory } from "../types";

export interface PublicEventCategoriesTableProps {
	categories: EventPublicCategory[];
}

export function PublicEventCategoriesTable({
	categories,
}: PublicEventCategoriesTableProps) {
	const sortedCategories = getSortedCategories(categories);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Race categories</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="hidden overflow-hidden rounded-xl border sm:block">
					<table className="w-full text-sm">
						<caption className="sr-only">
							Available event categories and distances
						</caption>
						<thead className="bg-muted/60 text-left text-muted-foreground">
							<tr>
								<th scope="col" className="px-4 py-3 font-medium">
									Name
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									Distance
								</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{sortedCategories.map((category) => (
								<tr key={category.slug}>
									<th scope="row" className="px-4 py-3 text-left font-medium">
										{category.name}
									</th>
									<td className="px-4 py-3 text-muted-foreground">
										{formatDistance(category.distanceMeters)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<dl className="space-y-3 sm:hidden">
					{sortedCategories.map((category) => (
						<div
							key={category.slug}
							className="rounded-xl border bg-background p-4"
						>
							<dt className="font-medium">{category.name}</dt>
							<dd className="mt-1 text-sm text-muted-foreground">
								{formatDistance(category.distanceMeters)}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

function getSortedCategories(categories: EventPublicCategory[]) {
	return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

function formatDistance(distanceMeters: number): string {
	const fractionDigits = distanceMeters % 1000 === 0 ? 0 : 2;
	return `${(distanceMeters / 1000).toFixed(fractionDigits)} km`;
}
