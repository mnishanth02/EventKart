import { z } from "zod/v4";
import {
	EVENT_CATEGORY_DEFAULT_SPOTS,
	EVENT_CATEGORY_MIN_SPOTS,
	EVENT_DISTANCE_CATEGORY_MAX_DISTANCE_METERS,
	EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT,
	EVENT_DISTANCE_CATEGORY_MAX_SORT_ORDER,
	EVENT_DISTANCE_CATEGORY_MIN_DISTANCE_METERS,
	EVENT_DISTANCE_CATEGORY_NAME_MAX_LENGTH,
	EVENT_DISTANCE_CATEGORY_PRESETS,
	EVENT_DISTANCE_CATEGORY_SLUG_MAX_LENGTH,
} from "../constants/event.js";
import { datetimeSchema } from "./date.js";
import { uuidSchema } from "./id.js";

export const eventCategorySlugSchema = z
	.string()
	.min(1, "Category slug is required")
	.max(
		EVENT_DISTANCE_CATEGORY_SLUG_MAX_LENGTH,
		`Category slug must be at most ${EVENT_DISTANCE_CATEGORY_SLUG_MAX_LENGTH} characters`,
	)
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		"Category slug must contain lowercase letters, numbers, and single hyphens only",
	)
	.brand<"EventCategorySlug">();

export const eventCategoryConfigSchema = z.object({
	name: z
		.string()
		.min(1, "Category name is required")
		.max(
			EVENT_DISTANCE_CATEGORY_NAME_MAX_LENGTH,
			`Category name must be at most ${EVENT_DISTANCE_CATEGORY_NAME_MAX_LENGTH} characters`,
		)
		.trim(),
	slug: eventCategorySlugSchema,
	distanceMeters: z
		.number()
		.int("Distance must be a whole number of meters")
		.min(
			EVENT_DISTANCE_CATEGORY_MIN_DISTANCE_METERS,
			"Distance must be at least 1 meter",
		)
		.max(
			EVENT_DISTANCE_CATEGORY_MAX_DISTANCE_METERS,
			`Distance must be at most ${EVENT_DISTANCE_CATEGORY_MAX_DISTANCE_METERS} meters`,
		),
	sortOrder: z
		.number()
		.int("Sort order must be a whole number")
		.min(0, "Sort order must be zero or greater")
		.max(
			EVENT_DISTANCE_CATEGORY_MAX_SORT_ORDER,
			`Sort order must be at most ${EVENT_DISTANCE_CATEGORY_MAX_SORT_ORDER}`,
		),
});

export const eventCategoriesConfigSchema = z
	.object({
		categories: z
			.array(eventCategoryConfigSchema)
			.min(1, "At least one event category is required")
			.max(
				EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT,
				`Events can have at most ${EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT} categories`,
			),
	})
	.superRefine((config, ctx) => {
		const seenSlugs = new Map<string, number>();
		const seenNames = new Map<string, number>();
		const seenSortOrders = new Map<number, number>();

		config.categories.forEach((category, index) => {
			const normalizedName = category.name.trim().toLowerCase();
			const existingSlugIndex = seenSlugs.get(category.slug);
			const existingNameIndex = seenNames.get(normalizedName);
			const existingSortOrderIndex = seenSortOrders.get(category.sortOrder);

			if (existingSlugIndex !== undefined) {
				ctx.addIssue({
					code: "custom",
					message: "Category slugs must be unique per event",
					path: ["categories", index, "slug"],
				});
				ctx.addIssue({
					code: "custom",
					message: "Category slugs must be unique per event",
					path: ["categories", existingSlugIndex, "slug"],
				});
			}

			if (existingNameIndex !== undefined) {
				ctx.addIssue({
					code: "custom",
					message: "Category names must be unique per event",
					path: ["categories", index, "name"],
				});
				ctx.addIssue({
					code: "custom",
					message: "Category names must be unique per event",
					path: ["categories", existingNameIndex, "name"],
				});
			}

			if (existingSortOrderIndex !== undefined) {
				ctx.addIssue({
					code: "custom",
					message: "Category sort orders must be unique per event",
					path: ["categories", index, "sortOrder"],
				});
				ctx.addIssue({
					code: "custom",
					message: "Category sort orders must be unique per event",
					path: ["categories", existingSortOrderIndex, "sortOrder"],
				});
			}

			seenSlugs.set(category.slug, index);
			seenNames.set(normalizedName, index);
			seenSortOrders.set(category.sortOrder, index);
		});
	});

export const eventCategoryRecordSchema = eventCategoryConfigSchema.extend({
	id: uuidSchema,
	eventId: uuidSchema,
	spotsTotal: z.number().int().min(EVENT_CATEGORY_MIN_SPOTS),
	spotsRemaining: z.number().int().min(0),
	createdAt: datetimeSchema,
	updatedAt: datetimeSchema,
});

/**
 * Capacity update schema for PATCH /events/:eventId/categories/:categoryId/capacity.
 * Both fields optional but at least one must be provided. spotsRemaining is
 * additionally validated against spotsTotal in the service layer.
 */
export const eventCategoryCapacityUpdateSchema = z
	.object({
		spotsTotal: z
			.number()
			.int("Spots total must be an integer")
			.min(EVENT_CATEGORY_MIN_SPOTS, "Spots total must be at least 1")
			.optional(),
		spotsRemaining: z
			.number()
			.int("Spots remaining must be an integer")
			.min(0, "Spots remaining must be zero or greater")
			.optional(),
	})
	.strict()
	.refine(
		(value) => Object.values(value).some((entry) => entry !== undefined),
		"At least one capacity field must be provided",
	);

export const defaultEventCategoriesConfig = {
	categories: EVENT_DISTANCE_CATEGORY_PRESETS.map((preset, index) => ({
		name: preset.label,
		slug: preset.slug,
		distanceMeters: preset.distanceMeters,
		sortOrder: index,
	})),
} satisfies EventCategoriesConfigInput;

export type EventCategorySlug = z.output<typeof eventCategorySlugSchema>;
export type EventCategoryConfigInput = z.input<
	typeof eventCategoryConfigSchema
>;
export type EventCategoryConfig = z.output<typeof eventCategoryConfigSchema>;
export type EventCategoriesConfigInput = z.input<
	typeof eventCategoriesConfigSchema
>;
export type EventCategoriesConfig = z.output<
	typeof eventCategoriesConfigSchema
>;
export type EventCategoryRecord = z.infer<typeof eventCategoryRecordSchema>;
export type EventCategoryCapacityUpdateInput = z.input<
	typeof eventCategoryCapacityUpdateSchema
>;
export type EventCategoryCapacityUpdate = z.output<
	typeof eventCategoryCapacityUpdateSchema
>;
