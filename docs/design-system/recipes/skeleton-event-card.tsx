/**
 * Recipe: Skeleton compositions for `<EventCard/>` and the organizer
 * `<AttendeeTable/>`.
 *
 * Skeletons should mirror the *exact* shape and rhythm of the real
 * component, otherwise content "jumps" on hydration. We use the project
 * `<Skeleton/>` primitive which already includes the EventKart shimmer
 * keyframe (token: `--motion-shimmer`).
 *
 * Common mistakes:
 *  - ❌ A single `<Skeleton className="h-64" />` placeholder — looks lazy
 *    and shifts layout once the real card mounts. Always model the slots.
 *  - ❌ Animating with a custom shimmer when one already lives in the
 *    `<Skeleton/>` primitive — duplicates motion + drains battery.
 */

import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function EventCardSkeleton() {
	return (
		<article
			aria-busy
			aria-label="Loading event"
			className="overflow-hidden rounded-2xl border bg-card"
		>
			{/* image, matches the real card's 16/9 aspect */}
			<Skeleton className="aspect-[16/9] w-full rounded-none" />

			<div className="space-y-3 p-4">
				{/* 2 title lines */}
				<Skeleton className="h-5 w-11/12" />
				<Skeleton className="h-5 w-7/12" />

				{/* 1 meta line (city · date) */}
				<Skeleton className="h-4 w-5/12" />

				{/* lane-line: price chip + CTA pill, separated by a flex-1 gap */}
				<div className="flex items-center gap-3 pt-2">
					<Skeleton className="h-7 w-20 rounded-full" />
					<div className="flex-1" />
					<Skeleton className="h-9 w-24 rounded-full" />
				</div>
			</div>
		</article>
	);
}

export function EventCardSkeletonGrid({ count = 6 }: { count?: number }) {
	return (
		<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: count }, (_, i) => (
				<li key={i}>
					<EventCardSkeleton />
				</li>
			))}
		</ul>
	);
}

type TableSkeletonProps = {
	rows?: number;
	cols?: number;
	/** Optional column header labels for SR users. */
	headers?: string[];
};

/** Generic table skeleton, used for the organizer attendee table. */
export function TableSkeleton({
	rows = 8,
	cols = 5,
	headers,
}: TableSkeletonProps) {
	const widths = ["w-32", "w-40", "w-24", "w-28", "w-16", "w-20", "w-36"];
	return (
		<div aria-busy aria-label="Loading attendees" className="overflow-hidden rounded-2xl border">
			<table className="w-full text-left text-sm">
				<thead className="bg-muted/40">
					<tr>
						{Array.from({ length: cols }, (_, c) => (
							<th key={c} scope="col" className="px-4 py-3">
								{headers?.[c] ? (
									<span className="text-muted-foreground">{headers[c]}</span>
								) : (
									<Skeleton className="h-4 w-20" />
								)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{Array.from({ length: rows }, (_, r) => (
						<tr key={r} className="border-t">
							{Array.from({ length: cols }, (_, c) => (
								<td key={c} className="px-4 py-3">
									<Skeleton className={`h-4 ${widths[(r + c) % widths.length]}`} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function AttendeeTableSkeleton() {
	return (
		<TableSkeleton
			rows={10}
			cols={5}
			headers={["Attendee", "Email", "Ticket", "Checked in", "Booked"]}
		/>
	);
}
