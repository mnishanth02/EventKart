/**
 * Participant-facing legal-document versions displayed on /privacy and /terms.
 *
 * These versions are the single source of truth for both the displayed
 * "Version X.X" label on the legal pages (apps/web/src/routes/_public/{privacy,terms}.tsx)
 * and -- once the Phase 3 booking flow lands -- the value stamped into
 * `consent_records.consent_version` when a participant accepts booking_terms /
 * data_usage at booking submission. Aligning the page version with the
 * stamped consent version is the "Versioned to align with consent_records.consent_version"
 * requirement called out in docs/v1-implementation-plan.md Module 2.5 rows 545-546.
 *
 * When you bump a version here, the next booking submission will require
 * re-consent (Phase 3 will key on this constant). Update the effective-date
 * line in the matching legal page at the same time.
 */
export const PARTICIPANT_LEGAL_DOC_IDS = ["privacy", "terms"] as const;

export type ParticipantLegalDocId = (typeof PARTICIPANT_LEGAL_DOC_IDS)[number];

export const PARTICIPANT_LEGAL_VERSIONS: Record<ParticipantLegalDocId, string> =
	{
		privacy: "1.0",
		terms: "1.0",
	} as const;
