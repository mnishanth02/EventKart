import { z } from "zod/v4";
import {
	organizerRegistrationSchema,
	organizerProfileSchema,
} from "@repo/shared/schemas";

// ── Request schemas ─────────────────────────────────────────────────

export const registerOrganizerBodySchema = organizerRegistrationSchema;

// ── Response schemas ────────────────────────────────────────────────

export const registerOrganizerResponseSchema = z.object({
	success: z.literal(true),
	data: organizerProfileSchema,
});

export const getOrganizerResponseSchema = z.object({
	success: z.literal(true),
	data: organizerProfileSchema,
});

export const organizerNotFoundResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});

export const organizerConflictResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});

export const organizerErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional(),
	}),
});
