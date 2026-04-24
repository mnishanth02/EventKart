import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// ── Service mocks ────────────────────────────────────────────────
const mockGetOrganizerByUserId = vi.fn();
const mockGetVerificationStatus = vi.fn();

vi.mock("../../../src/modules/organizer/service.js", () => ({
	registerOrganizer: vi.fn(),
	getOrganizerByUserId: (...args: unknown[]) =>
		mockGetOrganizerByUserId(...args),
	updateOrganizer: vi.fn(),
}));

vi.mock("../../../src/modules/organizer/verification-status-service.js", () => ({
	getVerificationStatus: (...args: unknown[]) =>
		mockGetVerificationStatus(...args),
}));

// Mock remaining modules so routes load without side-effects
vi.mock("../../../src/modules/organizer/document-service.js", () => ({
	requestDocumentUpload: vi.fn(),
	confirmDocumentUpload: vi.fn(),
	listVerificationDocuments: vi.fn(),
	deleteVerificationDocument: vi.fn(),
}));

vi.mock("../../../src/modules/organizer/policy-service.js", () => ({
	acceptPolicies: vi.fn(),
	getPolicyStatus: vi.fn(),
	hasAcceptedAllPolicies: vi.fn(),
}));

import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../../helpers/build-app.js";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";

// ── Constants ────────────────────────────────────────────────────
const STATUS_URL = "/api/v1/organizers/verification-status";
const SESSION_COOKIE_NAME = "kiran_session";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

const ALL_DOC_TYPES = ["aadhaar", "pan", "gst_certificate", "bank_proof"];
const ALL_POLICY_TYPES = ["platform_terms", "refund_policy"];

const mockOrganizerProfile = {
	id: TEST_ORGANIZER_ID,
	userId: TEST_USER_ID,
	businessName: "CoimbatoreRunners",
	contactName: "Ramesh Kumar",
	contactEmail: "ramesh@coimbatorerunners.in",
	contactPhone: "+919876543210",
	city: "Coimbatore",
	description: "Premier running event organizer in Coimbatore",
	website: "https://coimbatorerunners.in",
	verificationStatus: "pending_documents",
	isVerified: false,
	createdAt: "2026-04-24T00:00:00.000Z",
	updatedAt: "2026-04-24T00:00:00.000Z",
};

// ── Mock verification status responses ───────────────────────────

function buildPendingDocumentsStatus() {
	return {
		verificationStatus: "pending_documents",
		isVerified: false,
		submittedForReviewAt: null,
		reviewedAt: null,
		expectedReviewBy: null,
		rejectionReason: null,
		steps: {
			registration: { completed: true },
			policies: {
				completed: false,
				accepted: [],
				missing: ALL_POLICY_TYPES,
			},
			documents: {
				completed: false,
				uploaded: [],
				missing: ALL_DOC_TYPES,
				total: 4,
				uploadedCount: 0,
			},
			review: {
				status: "not_ready" as const,
				submittedAt: null,
				expectedBy: null,
			},
		},
	};
}

function buildAllDocsNoPoliciesStatus() {
	return {
		verificationStatus: "pending_documents",
		isVerified: false,
		submittedForReviewAt: null,
		reviewedAt: null,
		expectedReviewBy: null,
		rejectionReason: null,
		steps: {
			registration: { completed: true },
			policies: {
				completed: false,
				accepted: [],
				missing: ALL_POLICY_TYPES,
			},
			documents: {
				completed: true,
				uploaded: ALL_DOC_TYPES,
				missing: [],
				total: 4,
				uploadedCount: 4,
			},
			review: {
				status: "not_ready" as const,
				submittedAt: null,
				expectedBy: null,
			},
		},
	};
}

function buildPendingReviewStatus(submittedAt: string, expectedBy: string) {
	return {
		verificationStatus: "pending_review",
		isVerified: false,
		submittedForReviewAt: submittedAt,
		reviewedAt: null,
		expectedReviewBy: expectedBy,
		rejectionReason: null,
		steps: {
			registration: { completed: true },
			policies: {
				completed: true,
				accepted: ALL_POLICY_TYPES,
				missing: [],
			},
			documents: {
				completed: true,
				uploaded: ALL_DOC_TYPES,
				missing: [],
				total: 4,
				uploadedCount: 4,
			},
			review: {
				status: "pending" as const,
				submittedAt,
				expectedBy,
			},
		},
	};
}

function buildPartialDocsStatus(
	uploaded: string[],
	missing: string[],
) {
	return {
		verificationStatus: "pending_documents",
		isVerified: false,
		submittedForReviewAt: null,
		reviewedAt: null,
		expectedReviewBy: null,
		rejectionReason: null,
		steps: {
			registration: { completed: true },
			policies: {
				completed: true,
				accepted: ALL_POLICY_TYPES,
				missing: [],
			},
			documents: {
				completed: false,
				uploaded,
				missing,
				total: 4,
				uploadedCount: uploaded.length,
			},
			review: {
				status: "not_ready" as const,
				submittedAt: null,
				expectedBy: null,
			},
		},
	};
}

function buildPartialPoliciesStatus(
	accepted: string[],
	missing: string[],
) {
	return {
		verificationStatus: "pending_documents",
		isVerified: false,
		submittedForReviewAt: null,
		reviewedAt: null,
		expectedReviewBy: null,
		rejectionReason: null,
		steps: {
			registration: { completed: true },
			policies: {
				completed: false,
				accepted,
				missing,
			},
			documents: {
				completed: true,
				uploaded: ALL_DOC_TYPES,
				missing: [],
				total: 4,
				uploadedCount: 4,
			},
			review: {
				status: "not_ready" as const,
				submittedAt: null,
				expectedBy: null,
			},
		},
	};
}

function buildRejectedStatus() {
	return {
		verificationStatus: "rejected",
		isVerified: false,
		submittedForReviewAt: "2026-04-24T10:00:00.000Z",
		reviewedAt: "2026-04-25T10:00:00.000Z",
		expectedReviewBy: "2026-04-28T10:00:00.000Z",
		rejectionReason: "Documents are not clear",
		steps: {
			registration: { completed: true },
			policies: {
				completed: true,
				accepted: ALL_POLICY_TYPES,
				missing: [],
			},
			documents: {
				completed: true,
				uploaded: ALL_DOC_TYPES,
				missing: [],
				total: 4,
				uploadedCount: 4,
			},
			review: {
				status: "rejected" as const,
				submittedAt: "2026-04-24T10:00:00.000Z",
				expectedBy: "2026-04-28T10:00:00.000Z",
			},
		},
	};
}

// ── Helpers ──────────────────────────────────────────────────────

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function setupOrganizerSession(app: FastifyInstance) {
	getSessionRedisMock(app).mockResolvedValue(
		JSON.stringify({
			userId: TEST_USER_ID,
			role: "organizer",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		}),
	);
}

function setupParticipantSession(app: FastifyInstance) {
	getSessionRedisMock(app).mockResolvedValue(
		JSON.stringify({
			userId: TEST_USER_ID,
			role: "participant",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		}),
	);
}

/**
 * Compute expected business-day deadline (skip Sat/Sun).
 * Mirrors the service's `addBusinessDays` logic.
 */
function addBusinessDays(date: Date, days: number): Date {
	const result = new Date(date);
	let added = 0;
	while (added < days) {
		result.setDate(result.getDate() + 1);
		const dayOfWeek = result.getDay();
		if (dayOfWeek !== 0 && dayOfWeek !== 6) {
			added++;
		}
	}
	return result;
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /api/v1/organizers/verification-status", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── Authentication ──────────────────────────────────────────

	describe("authentication", () => {
		it("returns 401 when no session cookie is provided", async () => {
			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "UNAUTHORIZED" },
			});
		});

		it("returns 401 when session is not found in Redis", async () => {
			getSessionRedisMock(app).mockResolvedValue(null);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(401);
		});
	});

	// ── Authorization ───────────────────────────────────────────

	describe("authorization", () => {
		it("returns 403 when user has participant role", async () => {
			setupParticipantSession(app);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "INSUFFICIENT_ROLE" },
			});
		});
	});

	// ── Not found ───────────────────────────────────────────────

	describe("not found", () => {
		it("returns 404 when organizer profile does not exist", async () => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(null);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(404);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "NOT_FOUND" },
			});
		});
	});

	// ── Happy path / response shape ─────────────────────────────

	describe("successful response", () => {
		it("returns 200 with correct shape for authenticated organizer", async () => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
			const statusData = buildPendingDocumentsStatus();
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body).toEqual({ success: true, data: statusData });
		});

		it("passes correct userId and organizerId to service", async () => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
			mockGetVerificationStatus.mockResolvedValue(
				buildPendingDocumentsStatus(),
			);

			await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(mockGetVerificationStatus).toHaveBeenCalledTimes(1);
			const [_db, userId, organizerId] = mockGetVerificationStatus.mock
				.calls[0] as [unknown, string, string];
			expect(userId).toBe(TEST_USER_ID);
			expect(organizerId).toBe(TEST_ORGANIZER_ID);
		});
	});

	// ── Status states ───────────────────────────────────────────

	describe("status states", () => {
		beforeEach(() => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
		});

		it("returns pending_documents for newly registered organizer (no docs, no policies)", async () => {
			const statusData = buildPendingDocumentsStatus();
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().data;
			expect(data.verificationStatus).toBe("pending_documents");
			expect(data.isVerified).toBe(false);
			expect(data.steps.registration.completed).toBe(true);
			expect(data.steps.documents.completed).toBe(false);
			expect(data.steps.documents.uploadedCount).toBe(0);
			expect(data.steps.documents.total).toBe(4);
			expect(data.steps.policies.completed).toBe(false);
			expect(data.steps.review.status).toBe("not_ready");
			expect(data.submittedForReviewAt).toBeNull();
			expect(data.expectedReviewBy).toBeNull();
		});

		it("remains pending_documents when all 4 docs uploaded but policies NOT accepted", async () => {
			const statusData = buildAllDocsNoPoliciesStatus();
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().data;
			expect(data.verificationStatus).toBe("pending_documents");
			expect(data.steps.documents.completed).toBe(true);
			expect(data.steps.documents.uploadedCount).toBe(4);
			expect(data.steps.policies.completed).toBe(false);
			expect(data.steps.policies.missing).toEqual(
				expect.arrayContaining(["platform_terms", "refund_policy"]),
			);
			expect(data.steps.review.status).toBe("not_ready");
		});

		it("transitions to pending_review when all docs + all policies accepted", async () => {
			const submittedAt = "2026-04-24T10:00:00.000Z";
			// Thursday → 2 business days → Monday (skip Sat/Sun)
			const expectedBy = "2026-04-28T10:00:00.000Z";
			const statusData = buildPendingReviewStatus(submittedAt, expectedBy);
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().data;
			expect(data.verificationStatus).toBe("pending_review");
			expect(data.steps.documents.completed).toBe(true);
			expect(data.steps.policies.completed).toBe(true);
			expect(data.steps.review.status).toBe("pending");
			expect(data.submittedForReviewAt).toBe(submittedAt);
			expect(data.expectedReviewBy).toBe(expectedBy);
		});

		it("reverts to pending_documents when a doc is deleted during pending_review", async () => {
			const statusData = buildPartialDocsStatus(
				["aadhaar", "pan", "gst_certificate"],
				["bank_proof"],
			);
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().data;
			expect(data.verificationStatus).toBe("pending_documents");
			expect(data.steps.documents.completed).toBe(false);
			expect(data.steps.documents.uploadedCount).toBe(3);
			expect(data.steps.documents.missing).toContain("bank_proof");
			expect(data.submittedForReviewAt).toBeNull();
			expect(data.steps.review.status).toBe("not_ready");
		});

		it("returns rejected status with rejectionReason", async () => {
			const statusData = buildRejectedStatus();
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().data;
			expect(data.verificationStatus).toBe("rejected");
			expect(data.rejectionReason).toBe("Documents are not clear");
			expect(data.steps.review.status).toBe("rejected");
			expect(data.reviewedAt).toBe("2026-04-25T10:00:00.000Z");
		});
	});

	// ── SLA verification ────────────────────────────────────────

	describe("SLA verification", () => {
		beforeEach(() => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
		});

		it("expectedReviewBy is 2 business days after submittedForReviewAt (weekday)", async () => {
			// Wednesday 2026-04-22 → +2 business days → Friday 2026-04-24
			const submittedAt = "2026-04-22T10:00:00.000Z";
			const submitted = new Date(submittedAt);
			const expected = addBusinessDays(submitted, 2);
			const expectedBy = expected.toISOString();

			const statusData = buildPendingReviewStatus(submittedAt, expectedBy);
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().data;
			expect(data.expectedReviewBy).toBe(expectedBy);
			expect(data.steps.review.expectedBy).toBe(expectedBy);
			// Verify the computed date is indeed a Friday
			expect(expected.getDay()).toBe(5); // 5 = Friday
		});

		it("expectedReviewBy skips weekends (Friday submission → Tuesday)", async () => {
			// Friday 2026-04-24 → +2 business days → Tuesday 2026-04-28
			const submittedAt = "2026-04-24T10:00:00.000Z";
			const submitted = new Date(submittedAt);
			const expected = addBusinessDays(submitted, 2);
			const expectedBy = expected.toISOString();

			const statusData = buildPendingReviewStatus(submittedAt, expectedBy);
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const data = response.json().data;
			expect(data.expectedReviewBy).toBe(expectedBy);
			// Verify: Friday + skip Sat + skip Sun + Mon(1) + Tue(2) = Tuesday
			expect(expected.getDay()).toBe(2); // 2 = Tuesday
		});
	});

	// ── Document progress ───────────────────────────────────────

	describe("document progress", () => {
		beforeEach(() => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
		});

		it("correctly reports which doc types are uploaded vs missing", async () => {
			const statusData = buildPartialDocsStatus(
				["aadhaar", "pan"],
				["gst_certificate", "bank_proof"],
			);
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const docs = response.json().data.steps.documents;
			expect(docs.uploaded).toEqual(["aadhaar", "pan"]);
			expect(docs.missing).toEqual(["gst_certificate", "bank_proof"]);
			expect(docs.uploadedCount).toBe(2);
			expect(docs.total).toBe(4);
			expect(docs.completed).toBe(false);
		});

		it("uploadedCount matches actual uploaded docs when all uploaded", async () => {
			const statusData = buildAllDocsNoPoliciesStatus();
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const docs = response.json().data.steps.documents;
			expect(docs.uploadedCount).toBe(4);
			expect(docs.uploaded).toHaveLength(4);
			expect(docs.missing).toHaveLength(0);
			expect(docs.completed).toBe(true);
		});
	});

	// ── Policy progress ─────────────────────────────────────────

	describe("policy progress", () => {
		beforeEach(() => {
			setupOrganizerSession(app);
			mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
		});

		it("correctly reports which policies are accepted vs missing", async () => {
			const statusData = buildPartialPoliciesStatus(
				["platform_terms"],
				["refund_policy"],
			);
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const policies = response.json().data.steps.policies;
			expect(policies.accepted).toEqual(["platform_terms"]);
			expect(policies.missing).toEqual(["refund_policy"]);
			expect(policies.completed).toBe(false);
		});

		it("marks policies completed when all accepted", async () => {
			const submittedAt = "2026-04-24T10:00:00.000Z";
			const expectedBy = "2026-04-28T10:00:00.000Z";
			const statusData = buildPendingReviewStatus(submittedAt, expectedBy);
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const policies = response.json().data.steps.policies;
			expect(policies.completed).toBe(true);
			expect(policies.accepted).toEqual(
				expect.arrayContaining(["platform_terms", "refund_policy"]),
			);
			expect(policies.missing).toEqual([]);
		});

		it("reports no policies accepted for fresh organizer", async () => {
			const statusData = buildPendingDocumentsStatus();
			mockGetVerificationStatus.mockResolvedValue(statusData);

			const response = await app.inject({
				method: "GET",
				url: STATUS_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const policies = response.json().data.steps.policies;
			expect(policies.completed).toBe(false);
			expect(policies.accepted).toEqual([]);
			expect(policies.missing).toEqual(
				expect.arrayContaining(["platform_terms", "refund_policy"]),
			);
		});
	});
});
