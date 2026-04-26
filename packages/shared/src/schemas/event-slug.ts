import { z } from "zod/v4";
import {
	EVENT_SLUG_MAX_LENGTH,
	EVENT_SLUG_MIN_LENGTH,
	EVENT_SLUG_PATTERN,
} from "../utils/slug.js";

export const eventSlugSchema = z
	.string()
	.min(EVENT_SLUG_MIN_LENGTH, "Event slug is required")
	.max(
		EVENT_SLUG_MAX_LENGTH,
		`Event slug must be at most ${EVENT_SLUG_MAX_LENGTH} characters`,
	)
	.regex(
		EVENT_SLUG_PATTERN,
		"Event slug must contain lowercase letters, numbers, and single hyphens only",
	)
	.brand<"EventSlug">();

export type EventSlugInput = z.input<typeof eventSlugSchema>;
export type EventSlug = z.output<typeof eventSlugSchema>;
