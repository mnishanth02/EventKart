import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import type { PublicEventsListApiEnvelope } from "./api.server";

const publicEventsListInputSchema = z.object({
	page: z.number().int().min(1),
	limit: z.number().int().min(1).max(100),
	sort: z.enum(["startAtAsc", "startAtDesc"]),
});

export const getPublicEventsList = createServerFn({ method: "GET" })
	.inputValidator((data) => publicEventsListInputSchema.parse(data))
	.handler(async ({ data }): Promise<PublicEventsListApiEnvelope> => {
		const { getPublicEventsListOnServer } = await import("./api.server");
		return getPublicEventsListOnServer(data);
	});
