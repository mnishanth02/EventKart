import { describe, expect, expectTypeOf, it } from "vitest";
import {
	PARTICIPANT_LEGAL_DOC_IDS,
	PARTICIPANT_LEGAL_VERSIONS,
	type ParticipantLegalDocId,
} from "./legal-pages.js";

describe("PARTICIPANT_LEGAL_DOC_IDS", () => {
	it("is exactly ['privacy', 'terms']", () => {
		expect(PARTICIPANT_LEGAL_DOC_IDS).toEqual(["privacy", "terms"]);
	});
});

describe("PARTICIPANT_LEGAL_VERSIONS", () => {
	it("has exactly the keys from PARTICIPANT_LEGAL_DOC_IDS (no extras, none missing)", () => {
		const versionKeys = Object.keys(PARTICIPANT_LEGAL_VERSIONS).sort();
		const idKeys = [...PARTICIPANT_LEGAL_DOC_IDS].sort();
		expect(versionKeys).toEqual(idKeys);
	});

	it("has a non-empty version string for every doc id", () => {
		for (const id of PARTICIPANT_LEGAL_DOC_IDS) {
			expect(PARTICIPANT_LEGAL_VERSIONS[id]).toBeTruthy();
			expect(PARTICIPANT_LEGAL_VERSIONS[id].length).toBeGreaterThan(0);
		}
	});

	it("uses a semver-ish 'MAJOR.MINOR' format for every version", () => {
		const versionPattern = /^\d+\.\d+$/;
		for (const id of PARTICIPANT_LEGAL_DOC_IDS) {
			expect(PARTICIPANT_LEGAL_VERSIONS[id]).toMatch(versionPattern);
		}
	});
});

describe("ParticipantLegalDocId type", () => {
	it("is the string-literal union 'privacy' | 'terms'", () => {
		expectTypeOf<ParticipantLegalDocId>().toEqualTypeOf<
			"privacy" | "terms"
		>();

		const privacy: ParticipantLegalDocId = "privacy";
		const terms: ParticipantLegalDocId = "terms";
		expect(privacy).toBe("privacy");
		expect(terms).toBe("terms");
	});
});
