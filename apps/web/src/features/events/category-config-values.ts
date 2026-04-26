import type {
	EventCategoriesConfigInput,
	EventCategoryConfigInput,
	EventCategoryRecord,
} from "@repo/shared/schemas";
import { defaultEventCategoriesConfig } from "@repo/shared/schemas";

export function getDefaultEventCategoriesConfigValues(): EventCategoriesConfigInput {
	return {
		categories: defaultEventCategoriesConfig.categories.map((category) => ({
			...category,
		})),
	};
}

export function eventCategoryRecordsToConfigValues(
	categories: readonly EventCategoryRecord[] | null | undefined,
): EventCategoriesConfigInput {
	if (!categories || categories.length === 0) {
		return getDefaultEventCategoriesConfigValues();
	}

	return {
		categories: [...categories]
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(({ name, slug, distanceMeters, sortOrder }) => ({
				name,
				slug,
				distanceMeters,
				sortOrder,
			})),
	};
}

export function normalizeEventCategorySlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

export function reindexEventCategories(
	categories: readonly EventCategoryConfigInput[],
): EventCategoryConfigInput[] {
	return categories.map((category, index) => ({
		...category,
		sortOrder: index,
	}));
}

export function createBlankEventCategory(
	sortOrder: number,
): EventCategoryConfigInput {
	return {
		name: "",
		slug: "",
		distanceMeters: 1000,
		sortOrder,
	};
}
