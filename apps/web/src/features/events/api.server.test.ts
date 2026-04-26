// @vitest-environment node
import type { CreateEvent } from "@repo/shared/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverApiClient } from "#/lib/api-client.server";
import {
	assertSameOriginMutationRequest,
	getForwardedAuthHeaders,
} from "#/lib/auth/server-fns.server";
import { createEventOnServer } from "./api.server";

vi.mock("#/lib/api-client.server", () => ({
	serverApiClient: vi.fn(),
}));

vi.mock("#/lib/auth/server-fns.server", () => ({
	assertSameOriginMutationRequest: vi.fn(),
	getForwardedAuthHeaders: vi.fn(),
}));

const validCreateEvent = {
	title: "Coimbatore City 10K",
	description:
		"A paid running event for Coimbatore runners with a clearly marked city route.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road, Gopalapuram",
	addressLine2: undefined,
	city: "Coimbatore",
	state: "Tamil Nadu",
	country: "India",
	postalCode: undefined,
	timezone: "Asia/Kolkata",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails: "Single-loop 10K route through Race Course Road.",
	isPaid: true,
	currency: "INR",
} satisfies CreateEvent;

describe("createEventOnServer", () => {
	beforeEach(() => {
		vi.mocked(serverApiClient).mockReset();
		vi.mocked(assertSameOriginMutationRequest).mockReset();
		vi.mocked(getForwardedAuthHeaders).mockReturnValue({
			Cookie: "session=test-session",
			"X-Request-ID": "req-1",
		});
	});

	it("posts the validated event payload with forwarded auth headers", async () => {
		vi.mocked(serverApiClient).mockResolvedValueOnce({
			success: true,
			data: {
				...validCreateEvent,
				id: "11111111-1111-4111-8111-111111111111",
				organizerId: "22222222-2222-4222-8222-222222222222",
				slug: "coimbatore-city-10k",
				addressLine2: null,
				postalCode: null,
				status: "draft",
				createdAt: "2026-04-26T12:00:00.000Z",
				updatedAt: "2026-04-26T12:00:00.000Z",
			},
		});

		await createEventOnServer(validCreateEvent);

		expect(assertSameOriginMutationRequest).toHaveBeenCalledOnce();
		expect(serverApiClient).toHaveBeenCalledWith("/events", {
			method: "POST",
			body: validCreateEvent,
			headers: {
				Cookie: "session=test-session",
				"X-Request-ID": "req-1",
			},
		});
	});

	it("does not forward the mutation when same-origin validation fails", async () => {
		vi.mocked(assertSameOriginMutationRequest).mockImplementationOnce(() => {
			throw new Error("Invalid request origin");
		});

		await expect(createEventOnServer(validCreateEvent)).rejects.toThrow(
			"Invalid request origin",
		);

		expect(serverApiClient).not.toHaveBeenCalled();
	});
});
