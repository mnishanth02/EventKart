import { z } from "zod/v4";

/** Validates email and normalizes to lowercase. */
export const emailSchema = z
	.string()
	.email("Invalid email address")
	.transform((val) => val.toLowerCase());

export type EmailInput = z.input<typeof emailSchema>;
export type Email = z.output<typeof emailSchema>;
