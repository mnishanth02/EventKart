import { z } from "zod/v4";

/** UUID v4 identifier schema. */
export const uuidSchema = z.string().uuid("Invalid UUID format");

export type UUID = z.infer<typeof uuidSchema>;
