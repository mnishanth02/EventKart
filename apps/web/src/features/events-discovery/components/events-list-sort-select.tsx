import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import {
	PUBLIC_EVENTS_LIST_SORT_LABELS,
	PUBLIC_EVENTS_LIST_SORT_VALUES,
	type PublicEventsListSort,
} from "../search-params";

export interface EventsListSortSelectProps {
	value: PublicEventsListSort;
	onChange: (next: PublicEventsListSort) => void;
}

export function EventsListSortSelect({
	value,
	onChange,
}: EventsListSortSelectProps) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger aria-label="Sort events by" className="w-[180px]">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{PUBLIC_EVENTS_LIST_SORT_VALUES.map((sort) => (
					<SelectItem key={sort} value={sort}>
						{PUBLIC_EVENTS_LIST_SORT_LABELS[sort]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
