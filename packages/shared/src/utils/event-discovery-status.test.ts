import { describe, expect, it } from "vitest";
import type { EventDiscoveryStatusInput } from "./event-discovery-status.js";
import { getEventDiscoveryStatus } from "./event-discovery-status.js";

const NOW = new Date("2026-04-30T10:00:00.000Z");

function makeInput(
	overrides: Partial<EventDiscoveryStatusInput> = {},
): EventDiscoveryStatusInput {
	return {
		registrationOpensAt: "2026-04-30T09:00:00.000Z",
		registrationClosesAt: "2026-04-30T11:00:00.000Z",
		endAt: "2026-04-30T12:00:00.000Z",
		categories: [
			{
				capacity: {
					spotsTotal: 100,
					spotsRemaining: 10,
				},
			},
		],
		...overrides,
	};
}

function bounded(spotsRemaining: number) {
	return {
		capacity: {
			spotsTotal: 100,
			spotsRemaining,
		},
	};
}

const unlimited = { capacity: null };

describe("getEventDiscoveryStatus", () => {
	it("returns event_ended when the event has ended", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ endAt: "2026-04-30T09:59:59.000Z" }),
				NOW,
			),
		).toBe("event_ended");
	});

	it("returns registration_closed when the registration window has closed", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ registrationClosesAt: "2026-04-30T09:59:59.000Z" }),
				NOW,
			),
		).toBe("registration_closed");
	});

	it("returns upcoming before the registration window opens", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ registrationOpensAt: "2026-04-30T10:00:01.000Z" }),
				NOW,
			),
		).toBe("upcoming");
	});

	it("returns sold_out when every bounded category is sold out", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ categories: [bounded(0), bounded(0)] }),
				NOW,
			),
		).toBe("sold_out");
	});

	it("returns registration_open during an open window with available capacity", () => {
		expect(getEventDiscoveryStatus(makeInput(), NOW)).toBe("registration_open");
	});

	it("treats now equal to opensAt as open, not upcoming", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ registrationOpensAt: NOW.toISOString() }),
				NOW,
			),
		).toBe("registration_open");
	});

	it("treats now equal to closesAt as registration_closed", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ registrationClosesAt: NOW.toISOString() }),
				NOW,
			),
		).toBe("registration_closed");
	});

	it("treats now equal to endAt as event_ended", () => {
		expect(
			getEventDiscoveryStatus(makeInput({ endAt: NOW.toISOString() }), NOW),
		).toBe("event_ended");
	});

	it("returns event_ended when endAt is invalid", () => {
		expect(
			getEventDiscoveryStatus(makeInput({ endAt: "not-a-date" }), NOW),
		).toBe("event_ended");
	});

	it("returns registration_closed when closesAt is invalid", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ registrationClosesAt: "garbage" }),
				NOW,
			),
		).toBe("registration_closed");
	});

	it("ignores invalid opensAt and proceeds to open-window rules", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ registrationOpensAt: "garbage" }),
				NOW,
			),
		).toBe("registration_open");
	});

	it("returns event_ended when now is an Invalid Date", () => {
		expect(getEventDiscoveryStatus(makeInput(), new Date(Number.NaN))).toBe(
			"event_ended",
		);
	});

	it("returns registration_open for an open window with no categories", () => {
		expect(getEventDiscoveryStatus(makeInput({ categories: [] }), NOW)).toBe(
			"registration_open",
		);
	});

	it("returns registration_open when every category is unlimited", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ categories: [unlimited, unlimited] }),
				NOW,
			),
		).toBe("registration_open");
	});

	it("returns registration_open when an unlimited category blocks sold_out", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ categories: [bounded(0), unlimited] }),
				NOW,
			),
		).toBe("registration_open");
	});

	it("returns registration_open when one bounded category still has capacity", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({ categories: [bounded(0), bounded(5)] }),
				NOW,
			),
		).toBe("registration_open");
	});

	it("prioritizes registration_closed over sold_out", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({
					registrationClosesAt: NOW.toISOString(),
					categories: [bounded(0), bounded(0)],
				}),
				NOW,
			),
		).toBe("registration_closed");
	});

	it("prioritizes event_ended over sold_out", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({
					endAt: NOW.toISOString(),
					categories: [bounded(0), bounded(0)],
				}),
				NOW,
			),
		).toBe("event_ended");
	});

	it("prioritizes upcoming over sold_out", () => {
		expect(
			getEventDiscoveryStatus(
				makeInput({
					registrationOpensAt: "2026-04-30T10:00:01.000Z",
					categories: [bounded(0), bounded(0)],
				}),
				NOW,
			),
		).toBe("upcoming");
	});
});
