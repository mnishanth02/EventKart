/**
 * Recipe: Bento Grid Dashboard Layout
 *
 * Demonstrates an organizer dashboard composed with CSS Grid + the EventKart
 * `<Card span="...">` API. Row 1 holds 4 KPI cards (quarter spans). Row 2 has
 * a hero revenue chart (feature span) and an activity feed (third span).
 *
 * Key ideas:
 *  - Container queries (`@container`) drive collapse before viewport queries.
 *  - On narrow containers each card spans full width so the bento gracefully
 *    folds into a single column.
 *  - The grid uses `auto-rows-[minmax(0,1fr)]` so chart cards stretch nicely.
 *
 * Common mistakes:
 *  - ❌ Hard-coding `lg:col-span-*` instead of using the `span` prop — breaks
 *    when the dashboard is embedded in a narrower shell (e.g., side panel).
 *  - ❌ Forgetting `min-h-0` on chart cards causes recharts to grow infinitely.
 */

import { KPICard } from "@repo/ui/components/kpi-card";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { ActivityFeed } from "@repo/ui/components/activity-feed";
import { RevenueChart } from "@repo/ui/components/revenue-chart";
import { CalendarCheck, IndianRupee, Ticket, Users } from "lucide-react";

const kpis = [
	{
		label: "Gross Revenue",
		value: 1_284_500,
		delta: 12.4,
		icon: IndianRupee,
		spark: [12, 14, 13, 18, 22, 21, 26],
	},
	{
		label: "Tickets Sold",
		value: 8_421,
		delta: 4.1,
		icon: Ticket,
		spark: [120, 128, 142, 138, 161, 170, 184],
	},
	{
		label: "Attendees",
		value: 6_932,
		delta: -1.2,
		icon: Users,
		spark: [80, 82, 79, 84, 81, 78, 77],
	},
	{
		label: "Events Live",
		value: 14,
		delta: 0,
		icon: CalendarCheck,
		spark: [10, 11, 11, 12, 13, 14, 14],
	},
];

export function OrganizerBentoDashboard() {
	return (
		<section
			aria-label="Organizer overview"
			className="@container/bento w-full"
		>
			<div
				className={[
					"grid gap-4",
					// Mobile-first: single column. Container queries take over above 48rem.
					"grid-cols-1",
					"@[48rem]/bento:grid-cols-4",
					"@[48rem]/bento:auto-rows-[minmax(0,1fr)]",
				].join(" ")}
			>
				{kpis.map((kpi) => (
					<KPICard
						key={kpi.label}
						label={kpi.label}
						value={kpi.value}
						delta={kpi.delta}
						icon={kpi.icon}
						sparklineData={kpi.spark}
						span="quarter"
					/>
				))}

				<Card
					span="feature"
					className="min-h-0 @[48rem]/bento:col-span-3 @[48rem]/bento:row-span-2"
				>
					<CardHeader>
						<CardTitle>Revenue (last 30 days)</CardTitle>
						<CardDescription>
							All ticket categories, net of refunds.
						</CardDescription>
					</CardHeader>
					<CardContent className="h-[320px] min-h-0">
						<RevenueChart />
					</CardContent>
				</Card>

				<Card
					span="third"
					className="min-h-0 @[48rem]/bento:col-span-1 @[48rem]/bento:row-span-2"
				>
					<CardHeader>
						<CardTitle>Activity</CardTitle>
						<CardDescription>Bookings, refunds, check-ins.</CardDescription>
					</CardHeader>
					<CardContent className="min-h-0 overflow-y-auto">
						<ActivityFeed limit={20} />
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
