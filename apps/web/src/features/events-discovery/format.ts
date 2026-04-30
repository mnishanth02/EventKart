import type { EventCardData } from "./types";

export function formatCardDateRange(
	startAt: string,
	endAt: string,
	timezone: string,
): string {
	const start = new Date(startAt);
	const end = new Date(endAt);
	try {
		const dayFormatter = new Intl.DateTimeFormat("en-IN", {
			dateStyle: "medium",
			timeZone: timezone,
		});
		const timeFormatter = new Intl.DateTimeFormat("en-IN", {
			timeStyle: "short",
			timeZone: timezone,
		});
		const day = normalizeIntlSpaces(dayFormatter.formatRange(start, end));
		const time = sameLocalDay(start, end, timezone)
			? normalizeIntlSpaces(timeFormatter.formatRange(start, end))
			: `${normalizeIntlSpaces(timeFormatter.format(start))} – ${normalizeIntlSpaces(timeFormatter.format(end))}`;
		return `${day} · ${time}`;
	} catch {
		return normalizeIntlSpaces(
			new Intl.DateTimeFormat(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			}).formatRange(start, end),
		);
	}
}

function normalizeIntlSpaces(value: string): string {
	return value.replaceAll("\u202f", " ").replaceAll("\u2009", " ");
}

function sameLocalDay(start: Date, end: Date, timezone: string): boolean {
	const partsFormatter = new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "numeric",
		year: "numeric",
		timeZone: timezone,
	});
	return partsFormatter.format(start) === partsFormatter.format(end);
}

export function formatCategoryList(
	categories: EventCardData["categories"],
	max = 3,
): string {
	const visible = categories.slice(0, max).map((category) => category.name);
	const overflow = categories.length - visible.length;
	let formatted = "";
	try {
		formatted = new Intl.ListFormat("en-IN", {
			type: "conjunction",
		}).format(visible);
	} catch {
		formatted = visible.join(", ");
	}
	return overflow > 0 ? `${formatted} +${overflow} more` : formatted;
}

export function formatLocation(city: string, venueName: string): string {
	const normalizedCity = city.trim().toLocaleLowerCase("en-IN");
	const normalizedVenue = venueName.trim().toLocaleLowerCase("en-IN");
	if (normalizedCity === normalizedVenue) {
		return city;
	}
	return `${venueName}, ${city}`;
}
