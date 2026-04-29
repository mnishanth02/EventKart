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
const mockListVerifications = vi.fn();
const mockGetVerificationDetail = vi.fn();
const mockGetDocumentViewUrl = vi.fn();
const mockApproveOrganizer = vi.fn();
const mockRejectOrganizer = vi.fn();

vi.mock("../../../src/modules/admin/verification-service.js", () => ({
	listVerifications: (...args: unknown[]) => mockListVerifications(...args),
	getVerificationDetail: (...args: unknown[]) =>
		mockGetVerificationDetail(...args),
	getDocumentViewUrl: (...args: unknown[]) => mockGetDocumentViewUrl(...args),
	approveOrganizer: (...args: unknown[]) => mockApproveOrganizer(...args),
	rejectOrganizer: (...args: unknown[]) => mockRejectOrganizer(...args),
}));

import type { FastifyInstance } from "fastify";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";
import { buildTestApp } from "../../helpers/build-app.js";

// ── Constants ────────────────────────────────────────────────────
const BASE_URL = "/api/v1/admin/verifications";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_ADMIN_ID = "aa0e8400-e29b-41d4-a716-446655440001";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "bb0e8400-e29b-41d4-a716-446655440010";
const TEST_DOCUMENT_ID = "cc0e8400-e29b-41d4-a716-446655440020";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

const mockListResult = {
	data: [
		{
			id: TEST_ORGANIZER_ID,
			userId: TEST_USER_ID,
			businessName: "CoimbatoreRunners",
			contactName: "Ramesh Kumar",
			contactEmail: "ramesh@coimbatorerunners.in",
			city: "Coimbatore",
			verificationStatus: "pending_review",
			submittedForReviewAt: "2026-04-24T00:00:00.000Z",
			documentCount: 4,
			createdAt: "2026-04-24T00:00:00.000Z",
		},
	],
	meta: {
		page: 1,
		limit: 20,
		total: 1,
		totalPages: 1,
		hasNext: false,
		hasPrev: false,
	},
};

const mockDetailResult = {
	organizer: {
		id: TEST_ORGANIZER_ID,
		userId: TEST_USER_ID,
		slug: "coimbatorerunners",
		businessName: "CoimbatoreRunners",
		contactName: "Ramesh Kumar",
		contactEmail: "ramesh@coimbatorerunners.in",
		contactPhone: "+919876543210",
		city: "Coimbatore",
		description: "Premier running event organizer",
		website: "https://coimbatorerunners.in",
		verificationStatus: "pending_review",
		isVerified: false,
		razorpayAccountStatus: "not_started",
		submittedForReviewAt: "2026-04-24T00:00:00.000Z",
		reviewedAt: null,
		rejectionReason: null,
		createdAt: "2026-04-24T00:00:00.000Z",
		updatedAt: "2026-04-24T00:00:00.000Z",
	},
	documents: [
		{
			id: TEST_DOCUMENT_ID,
			organizerId: TEST_ORGANIZER_ID,
			documentType: "aadhaar",
			fileName: "aadhaar-card.pdf",
			contentType: "application/pdf",
			fileSize: 1024000,
			status: "uploaded",
			createdAt: "2026-04-24T00:00:00.000Z",
			updatedAt: "2026-04-24T00:00:00.000Z",
		},
	],
	policiesAccepted: true,
	policyDetails: [
		{
			policyType: "terms_of_service",
			isAccepted: true,
			acceptedAt: "2026-04-24T00:00:00.000Z",
			version: "1.0",
		},
	],
};

const mockDocumentViewUrlResult = {
	url: "https://s3.example.com/presigned-download-url",
	expiresAt: new Date(Date.now() + 900_000).toISOString(),
	documentId: TEST_DOCUMENT_ID,
	documentType: "aadhaar",
	fileName: "aadhaar-card.pdf",
	contentType: "application/pdf",
};

const mockApproveResult = {
	organizerId: TEST_ORGANIZER_ID,
	verificationStatus: "approved",
	isVerified: true,
	reviewedAt: "2026-04-24T12:00:00.000Z",
	reviewedBy: TEST_ADMIN_ID,
};

const mockRejectResult = {
	organizerId: TEST_ORGANIZER_ID,
	verificationStatus: "rejected",
	isVerified: false,
	reviewedAt: "2026-04-24T12:00:00.000Z",
	reviewedBy: TEST_ADMIN_ID,
};

// ── Helpers ──────────────────────────────────────────────────────

function getSessionRedisMock(app: FastifyInstance) {
	return app.redis.session.get as ReturnType<typeof vi.fn>;
}

function setupAdminSession(app: FastifyInstance) {
	getSessionRedisMock(app).mockResolvedValue(
		JSON.stringify({
			userId: TEST_ADMIN_ID,
			role: "admin",
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		}),
	);
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

function buildCsrfHeaders() {
	const csrfToken = generateCsrfToken(TEST_SESSION_ID, TEST_CSRF_SECRET);
	return {
		cookies: {
			[SESSION_COOKIE_NAME]: TEST_SESSION_ID,
			[CSRF_COOKIE_NAME]: csrfToken,
		},
		headers: {
			[CSRF_HEADER_NAME]: csrfToken,
		},
	};
}

// ── Tests: GET /api/v1/admin/verifications ──────────────────────

describe("GET /api/v1/admin/verifications", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockListVerifications.mockReset();
	});

	it("returns paginated list of verifications", async () => {
		setupAdminSession(app);
		mockListVerifications.mockResolvedValue(mockListResult);

		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data).toHaveLength(1);
		expect(body.meta.total).toBe(1);
	});

	it("filters by status", async () => {
		setupAdminSession(app);
		mockListVerifications.mockResolvedValue(mockListResult);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}?status=pending_review`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(mockListVerifications).toHaveBeenCalledTimes(1);
		const [, params] = mockListVerifications.mock.calls[0] as [
			unknown,
			{ status?: string },
		];
		expect(params.status).toBe("pending_review");
	});

	it("returns empty list when no verifications", async () => {
		setupAdminSession(app);
		mockListVerifications.mockResolvedValue({
			data: [],
			meta: {
				page: 1,
				limit: 20,
				total: 0,
				totalPages: 0,
				hasNext: false,
				hasPrev: false,
			},
		});

		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().data).toHaveLength(0);
	});

	it("returns 401 when unauthenticated", async () => {
		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
	});

	it("returns 403 for non-admin users", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
	});
});

// ── Tests: GET /api/v1/admin/verifications/:organizerId ─────────

describe("GET /api/v1/admin/verifications/:organizerId", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockGetVerificationDetail.mockReset();
	});

	it("returns organizer detail with documents and policy status", async () => {
		setupAdminSession(app);
		mockGetVerificationDetail.mockResolvedValue(mockDetailResult);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data.organizer.id).toBe(TEST_ORGANIZER_ID);
		expect(body.data.documents).toHaveLength(1);
		expect(body.data.policiesAccepted).toBe(true);
	});

	it("returns 404 for non-existent organizer", async () => {
		setupAdminSession(app);
		const { NotFoundError } = await import("../../../src/lib/errors.js");
		mockGetVerificationDetail.mockRejectedValue(
			new NotFoundError("Organizer not found"),
		);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});

	it("returns 403 for non-admin", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
	});
});

// ── Tests: GET .../documents/:documentId/view-url ───────────────

describe("GET /api/v1/admin/verifications/:organizerId/documents/:documentId/view-url", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
		Object.assign(app.storage, { enabled: true });
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockGetDocumentViewUrl.mockReset();
	});

	it("returns presigned URL for valid document", async () => {
		setupAdminSession(app);
		mockGetDocumentViewUrl.mockResolvedValue(mockDocumentViewUrlResult);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/documents/${TEST_DOCUMENT_ID}/view-url`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data.url).toBe(mockDocumentViewUrlResult.url);
		expect(body.data.documentId).toBe(TEST_DOCUMENT_ID);
	});

	it("returns 404 if document does not belong to organizer", async () => {
		setupAdminSession(app);
		const { NotFoundError } = await import("../../../src/lib/errors.js");
		mockGetDocumentViewUrl.mockRejectedValue(
			new NotFoundError("Document not found"),
		);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/documents/${TEST_DOCUMENT_ID}/view-url`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});

	it("returns 404 for non-existent document", async () => {
		setupAdminSession(app);
		const { NotFoundError } = await import("../../../src/lib/errors.js");
		const fakeDocId = "dd0e8400-e29b-41d4-a716-446655440099";
		mockGetDocumentViewUrl.mockRejectedValue(
			new NotFoundError("Document not found"),
		);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/documents/${fakeDocId}/view-url`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(404);
	});

	it("returns 403 for non-admin", async () => {
		setupOrganizerSession(app);

		const response = await app.inject({
			method: "GET",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/documents/${TEST_DOCUMENT_ID}/view-url`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(403);
	});
});

// ── Tests: POST .../approve ─────────────────────────────────────

describe("POST /api/v1/admin/verifications/:organizerId/approve", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockApproveOrganizer.mockReset();
	});

	it("successfully approves a pending_review organizer", async () => {
		setupAdminSession(app);
		mockApproveOrganizer.mockResolvedValue(mockApproveResult);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/approve`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data.verificationStatus).toBe("approved");
		expect(body.data.isVerified).toBe(true);
		expect(body.data.reviewedBy).toBe(TEST_ADMIN_ID);
	});

	it("passes notes to service when provided", async () => {
		setupAdminSession(app);
		mockApproveOrganizer.mockResolvedValue(mockApproveResult);
		const csrf = buildCsrfHeaders();

		await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/approve`,
			...csrf,
			payload: { notes: "All documents verified successfully" },
		});

		expect(mockApproveOrganizer).toHaveBeenCalledTimes(1);
		const callArgs = mockApproveOrganizer.mock.calls[0] as unknown[];
		// args: db, log, adminUserId, organizerId, ipAddress, notes
		expect(callArgs[2]).toBe(TEST_ADMIN_ID);
		expect(callArgs[3]).toBe(TEST_ORGANIZER_ID);
		expect(callArgs[5]).toBe("All documents verified successfully");
	});

	it("returns 409 if not in pending_review status", async () => {
		setupAdminSession(app);
		const { ConflictError } = await import("../../../src/lib/errors.js");
		mockApproveOrganizer.mockRejectedValue(
			new ConflictError("Organizer is not in pending_review status"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/approve`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CONFLICT" },
		});
	});

	it("returns 404 for non-existent organizer", async () => {
		setupAdminSession(app);
		const { NotFoundError } = await import("../../../src/lib/errors.js");
		mockApproveOrganizer.mockRejectedValue(
			new NotFoundError("Organizer not found"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/approve`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(404);
	});

	it("requires CSRF token", async () => {
		setupAdminSession(app);

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/approve`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: {},
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
	});

	it("returns 403 for non-admin", async () => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/approve`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
	});

	it("returns 401 when unauthenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/approve`,
			payload: {},
		});

		expect(response.statusCode).toBe(401);
	});
});

// ── Tests: POST .../reject ──────────────────────────────────────

describe("POST /api/v1/admin/verifications/:organizerId/reject", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockRejectOrganizer.mockReset();
	});

	it("successfully rejects with reason", async () => {
		setupAdminSession(app);
		mockRejectOrganizer.mockResolvedValue(mockRejectResult);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/reject`,
			...csrf,
			payload: {
				reason: "Documents are not legible. Please re-upload clearer copies.",
			},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data.verificationStatus).toBe("rejected");
		expect(body.data.isVerified).toBe(false);
	});

	it("returns 409 if not in pending_review status", async () => {
		setupAdminSession(app);
		const { ConflictError } = await import("../../../src/lib/errors.js");
		mockRejectOrganizer.mockRejectedValue(
			new ConflictError("Organizer is not in pending_review status"),
		);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/reject`,
			...csrf,
			payload: {
				reason: "Documents are not legible. Please re-upload clearer copies.",
			},
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CONFLICT" },
		});
	});

	it("returns 400 for missing reason", async () => {
		setupAdminSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/reject`,
			...csrf,
			payload: {},
		});

		expect(response.statusCode).toBe(400);
	});

	it("returns 400 for short reason", async () => {
		setupAdminSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/reject`,
			...csrf,
			payload: { reason: "Bad" },
		});

		expect(response.statusCode).toBe(400);
	});

	it("requires CSRF token", async () => {
		setupAdminSession(app);

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/reject`,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			payload: {
				reason: "Documents are not legible. Please re-upload clearer copies.",
			},
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "CSRF_VALIDATION_FAILED" },
		});
	});

	it("returns 403 for non-admin", async () => {
		setupOrganizerSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/reject`,
			...csrf,
			payload: {
				reason: "Documents are not legible. Please re-upload clearer copies.",
			},
		});

		expect(response.statusCode).toBe(403);
	});

	it("returns 401 when unauthenticated", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/${TEST_ORGANIZER_ID}/reject`,
			payload: {
				reason: "Documents are not legible. Please re-upload clearer copies.",
			},
		});

		expect(response.statusCode).toBe(401);
	});
});
