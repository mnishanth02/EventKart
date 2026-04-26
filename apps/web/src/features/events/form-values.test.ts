import { describe, expect, it } from "vitest";
import {
	V1_EVENT_ALLOWED_VALUES,
	V1_EVENT_CITY,
	V1_EVENT_TIMEZONE,
} from "@repo/shared/constants";
import {
	coimbatoreDateTimeLocalToIso,
	getDefaultCreateEventValues,
	isoToCoimbatoreDateTimeLocal,
} from "./form-values";

describe("event form values", () => {
	it("sets V1 defaults for paid running events in Coimbatore", () => {
		expect(getDefaultCreateEventValues()).toMatchObject({
			...V1_EVENT_ALLOWED_VALUES,
			city: V1_EVENT_CITY,
			timezone: V1_EVENT_TIMEZONE,
		});
	});

	it("converts Coimbatore local datetime values to ISO strings", () => {
		expect(coimbatoreDateTimeLocalToIso("2026-08-15T06:00")).toBe(
			"2026-08-15T00:30:00.000Z",
		);
	});

	it("converts ISO strings back to Coimbatore local datetime values", () => {
		expect(isoToCoimbatoreDateTimeLocal("2026-08-15T00:30:00.000Z")).toBe(
			"2026-08-15T06:00",
		);
	});
});
