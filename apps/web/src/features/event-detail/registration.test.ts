import { describe, expect, it } from "vitest";
import {
	formatRegistrationDate,
	getBookingHref,
	getNextBoundaryMs,
	getRegistrationState,
	type RegistrationWindowFields,
} from "./registration";
import type { EventPublicDetail } from "./types";

const baseEvent: RegistrationWindowFields = {
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
};

describe("getRegistrationState", () => {
	it("returns 'unknown' when now is null (SSR / pre-mount baseline)", () => {
		expect(getRegistrationState(baseEvent, null)).toBe("unknown");
	});

	it("returns 'not_yet_open' when now is strictly before opensAt", () => {
		const now = new Date("2026-06-01T00:00:00.000Z");
		expect(getRegistrationState(baseEvent, now)).toBe("not_yet_open");
	});

	it("returns 'open' exactly at opensAt (`<` boundary, not `<=`)", () => {
		const now = new Date("2026-07-01T03:30:00.000Z");
		expect(getRegistrationState(baseEvent, now)).toBe("open");
	});

	it("returns 'open' inside the registration window", () => {
		const now = new Date("2026-07-15T00:00:00.000Z");
		expect(getRegistrationState(baseEvent, now)).toBe("open");
	});

	it("returns 'closed_window' exactly at closesAt (`>=` boundary)", () => {
		const now = new Date("2026-08-14T12:30:00.000Z");
		expect(getRegistrationState(baseEvent, now)).toBe("closed_window");
	});

	it("returns 'closed_window' after closesAt but before endAt", () => {
		const now = new Date("2026-08-14T18:00:00.000Z");
		expect(getRegistrationState(baseEvent, now)).toBe("closed_window");
	});

	it("returns 'event_ended' exactly at endAt (`>=` boundary)", () => {
		const now = new Date("2026-08-15T03:30:00.000Z");
		expect(getRegistrationState(baseEvent, now)).toBe("event_ended");
	});

	it("returns 'event_ended' after endAt", () => {
		const now = new Date("2026-09-01T00:00:00.000Z");
		expect(getRegistrationState(baseEvent, now)).toBe("event_ended");
	});

	it("'event_ended' takes precedence over 'closed_window'", () => {
		const eventEndedFirst: RegistrationWindowFields = {
			registrationOpensAt: "2026-07-01T00:00:00.000Z",
			registrationClosesAt: "2026-09-01T00:00:00.000Z",
			endAt: "2026-08-15T00:00:00.000Z",
		};
		const now = new Date("2026-08-20T00:00:00.000Z");
		expect(getRegistrationState(eventEndedFirst, now)).toBe("event_ended");
	});

	it("treats both registration timestamps as null and returns 'open' when before endAt", () => {
		const noWindow: RegistrationWindowFields = {
			registrationOpensAt: null,
			registrationClosesAt: null,
			endAt: "2026-08-15T03:30:00.000Z",
		};
		const now = new Date("2026-07-15T00:00:00.000Z");
		expect(getRegistrationState(noWindow, now)).toBe("open");
	});

	it("falls back to 'event_ended' when endAt is unparseable (fail-safe)", () => {
		const corrupt: RegistrationWindowFields = {
			registrationOpensAt: null,
			registrationClosesAt: null,
			endAt: "not-a-date",
		};
		const now = new Date("2026-07-15T00:00:00.000Z");
		expect(getRegistrationState(corrupt, now)).toBe("event_ended");
	});

	it("falls back to 'closed_window' when registrationClosesAt is unparseable (fail-closed)", () => {
		const corrupt: RegistrationWindowFields = {
			registrationOpensAt: null,
			registrationClosesAt: "not-a-date",
			endAt: "2026-08-15T03:30:00.000Z",
		};
		const now = new Date("2026-07-15T00:00:00.000Z");
		expect(getRegistrationState(corrupt, now)).toBe("closed_window");
	});

	it("ignores an unparseable registrationOpensAt (treats bound as not set)", () => {
		const corrupt: RegistrationWindowFields = {
			registrationOpensAt: "not-a-date",
			registrationClosesAt: null,
			endAt: "2026-08-15T03:30:00.000Z",
		};
		const now = new Date("2026-07-15T00:00:00.000Z");
		expect(getRegistrationState(corrupt, now)).toBe("open");
	});

	it("returns 'event_ended' when only endAt is set and now equals endAt", () => {
		const onlyEnd: RegistrationWindowFields = {
			registrationOpensAt: null,
			registrationClosesAt: null,
			endAt: "2026-08-15T03:30:00.000Z",
		};
		const now = new Date("2026-08-15T03:30:00.000Z");
		expect(getRegistrationState(onlyEnd, now)).toBe("event_ended");
	});
});

describe("getBookingHref", () => {
	it("builds /events/<slug>/register", () => {
		// EventSlug is a Zod-branded string; the helper is a pure string
		// concatenation so we cast through `unknown` to skip parsing in tests.
		expect(
			getBookingHref({
				slug: "coimbatore-city-10k" as unknown as EventPublicDetail["slug"],
			}),
		).toBe("/events/coimbatore-city-10k/register");
	});
});

describe("getNextBoundaryMs", () => {
	it("returns the soonest future boundary among opensAt/closesAt/endAt", () => {
		const now = new Date("2026-06-01T00:00:00.000Z");
		const ms = getNextBoundaryMs(baseEvent, now);
		expect(ms).toBe(Date.parse("2026-07-01T03:30:00.000Z"));
	});

	it("returns the next future boundary even when prior bounds have passed", () => {
		const now = new Date("2026-08-01T00:00:00.000Z");
		const ms = getNextBoundaryMs(baseEvent, now);
		expect(ms).toBe(Date.parse("2026-08-14T12:30:00.000Z"));
	});

	it("returns null when all boundaries are in the past", () => {
		const now = new Date("2099-01-01T00:00:00.000Z");
		const ms = getNextBoundaryMs(baseEvent, now);
		expect(ms).toBeNull();
	});

	it("ignores null and unparseable bounds", () => {
		const messy: RegistrationWindowFields = {
			registrationOpensAt: null,
			registrationClosesAt: "not-a-date",
			endAt: "2026-08-15T03:30:00.000Z",
		};
		const now = new Date("2026-06-01T00:00:00.000Z");
		const ms = getNextBoundaryMs(messy, now);
		expect(ms).toBe(Date.parse("2026-08-15T03:30:00.000Z"));
	});
});

describe("formatRegistrationDate", () => {
	it("emits a short timezone label (e.g. IST) so cross-locale viewers can disambiguate", () => {
		const out = formatRegistrationDate(
			"2026-07-01T03:30:00.000Z",
			"Asia/Kolkata",
		);
		expect(out).toMatch(/IST|GMT\+5:30/);
		expect(out).toMatch(/9:00/);
	});

	it("falls back to the runtime locale when the timezone is unknown", () => {
		const out = formatRegistrationDate(
			"2026-07-01T03:30:00.000Z",
			"Not/AReal_Zone",
		);
		expect(typeof out).toBe("string");
		expect(out.length).toBeGreaterThan(0);
	});
});
