import { z } from "zod/v4";

/** ISO 8601 date string (YYYY-MM-DD). */
export const dateSchema = z.string().date();

/** ISO 8601 datetime string. */
export const datetimeSchema = z.string().datetime();

/** Timestamp that coerces to a Date object. */
export const timestampSchema = z.coerce.date();

export type DateString = z.infer<typeof dateSchema>;
export type DateTimeString = z.infer<typeof datetimeSchema>;
export type Timestamp = z.infer<typeof timestampSchema>;
