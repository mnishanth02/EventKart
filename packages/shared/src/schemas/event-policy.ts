import { z } from "zod/v4";
import { EVENT_POLICY_MAX_LENGTH } from "../constants/event.js";
import { datetimeSchema } from "./date.js";
import { uuidSchema } from "./id.js";

export const eventPolicyTextSchema = z
	.string()
	.trim()
	.min(1, "Policy text is required")
	.max(
		EVENT_POLICY_MAX_LENGTH,
		`Policy text must not exceed ${EVENT_POLICY_MAX_LENGTH} characters`,
	);

export const eventPoliciesConfigSchema = z.object({
	refundPolicy: eventPolicyTextSchema,
	cancellationPolicy: eventPolicyTextSchema,
});

export const eventPoliciesRecordSchema = z.object({
	eventId: uuidSchema,
	refundPolicy: z.string().nullable(),
	cancellationPolicy: z.string().nullable(),
	updatedAt: datetimeSchema,
});

export type EventPoliciesConfigInput = z.input<
	typeof eventPoliciesConfigSchema
>;
export type EventPoliciesConfig = z.output<typeof eventPoliciesConfigSchema>;
export type EventPoliciesRecord = z.infer<typeof eventPoliciesRecordSchema>;
