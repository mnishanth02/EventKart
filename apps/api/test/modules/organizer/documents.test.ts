import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// ── Service mocks ────────────────────────────────────────────────
const mockRequestDocumentUpload = vi.fn();
const mockConfirmDocumentUpload = vi.fn();
const mockListVerificationDocuments = vi.fn();
const mockDeleteVerificationDocument = vi.fn();
const mockRegisterOrganizer = vi.fn();
const mockGetOrganizerByUserId = vi.fn();

vi.mock("../../../src/modules/organizer/document-service.js", () => ({
	requestDocumentUpload: (...args: unknown[]) => mockRequestDocumentUpload(...args),
	confirmDocumentUpload: (...args: unknown[]) => mockConfirmDocumentUpload(...args),
	listVerificationDocuments: (...args: unknown[]) => mockListVerificationDocuments(...args),
	deleteVerificationDocument: (...args: unknown[]) => mockDeleteVerificationDocument(...args),
}));

vi.mock("../../../src/modules/organizer/service.js", () => ({
	registerOrganizer: (...args: unknown[]) => mockRegisterOrganizer(...args),
	getOrganizerByUserId: (...args: unknown[]) => mockGetOrganizerByUserId(...args),
}));

import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../../helpers/build-app.js";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";

// ── Constants ────────────────────────────────────────────────────
const BASE_URL = "/api/v1/organizers/documents";
const UPLOAD_URL = `${BASE_URL}/upload-url`;
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORGANIZER_ID = "660e8400-e29b-41d4-a716-446655440001";
const TEST_DOCUMENT_ID = "770e8400-e29b-41d4-a716-446655440002";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

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

const mockUploadUrlResult = {
	documentId: TEST_DOCUMENT_ID,
	url: "https://s3.example.com/presigned-url",
	method: "PUT" as const,
	headers: { "Content-Type": "application/pdf", "x-amz-server-side-encryption": "AES256" },
	key: `kyc/${TEST_ORGANIZER_ID}/some-uuid.pdf`,
	expiresAt: new Date(Date.now() + 900_000).toISOString(),
};

const mockDocumentRecord = {
	id: TEST_DOCUMENT_ID,
	organizerId: TEST_ORGANIZER_ID,
	documentType: "aadhaar" as const,
	fileName: "aadhaar-card.pdf",
	contentType: "application/pdf",
	fileSize: 1024000,
	status: "uploaded" as const,
	createdAt: "2026-04-24T00:00:00.000Z",
	updatedAt: "2026-04-24T00:00:00.000Z",
};

const validUploadBody = {
	documentType: "aadhaar",
	fileName: "aadhaar-card.pdf",
	contentType: "application/pdf",
};

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

function enableStorage(app: FastifyInstance) {
	Object.assign(app.storage, { enabled: true });
}

// ── Tests: POST /api/v1/organizers/documents/upload-url ─────────

describe("POST /api/v1/organizers/documents/upload-url", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
		enableStorage(app);
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		setupOrganizerSession(app);
		mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
	});

	// ── Happy path ──────────────────────────────────────────────

	it("returns 200 with presigned URL for valid request", async () => {
		mockRequestDocumentUpload.mockResolvedValue(mockUploadUrlResult);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: UPLOAD_URL,
			...csrf,
			payload: validUploadBody,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: mockUploadUrlResult,
		});
	});

	// ── Authentication ──────────────────────────────────────────

	it("returns 401 when no session", async () => {
		getSessionRedisMock(app).mockReset();

		const response = await app.inject({
			method: "POST",
			url: UPLOAD_URL,
			payload: validUploadBody,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
	});

	// ── Authorization ───────────────────────────────────────────

	it("returns 403 when participant role", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: UPLOAD_URL,
			...csrf,
			payload: validUploadBody,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
	});

	// ── Validation ──────────────────────────────────────────────

	it("returns 400 for invalid documentType", async () => {
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: UPLOAD_URL,
			...csrf,
			payload: { ...validUploadBody, documentType: "invalid_type" },
		});

		expect(response.statusCode).toBe(400);
	});

	it("returns 400 for invalid contentType", async () => {
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: UPLOAD_URL,
			...csrf,
			payload: { ...validUploadBody, contentType: "text/plain" },
		});

		expect(response.statusCode).toBe(400);
	});

	// ── Not found ───────────────────────────────────────────────

	it("returns 404 when no organizer profile exists", async () => {
		mockGetOrganizerByUserId.mockResolvedValue(null);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: UPLOAD_URL,
			...csrf,
			payload: validUploadBody,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});
});

// ── Tests: POST /api/v1/organizers/documents/:documentId/confirm ─

describe("POST /api/v1/organizers/documents/:documentId/confirm", () => {
	let app: FastifyInstance;
	const CONFIRM_URL = `${BASE_URL}/${TEST_DOCUMENT_ID}/confirm`;

	beforeAll(async () => {
		app = await buildTestApp();
		enableStorage(app);
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		setupOrganizerSession(app);
		mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
	});

	// ── Happy path ──────────────────────────────────────────────

	it("returns 200 with confirmed document on success", async () => {
		mockConfirmDocumentUpload.mockResolvedValue(mockDocumentRecord);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: CONFIRM_URL,
			...csrf,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: mockDocumentRecord,
		});
	});

	// ── Authentication ──────────────────────────────────────────

	it("returns 401 when no session", async () => {
		getSessionRedisMock(app).mockReset();

		const response = await app.inject({
			method: "POST",
			url: CONFIRM_URL,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
	});

	// ── Authorization ───────────────────────────────────────────

	it("returns 403 when participant role", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: CONFIRM_URL,
			...csrf,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
	});

	// ── Validation ──────────────────────────────────────────────

	it("returns 400 for invalid documentId (not UUID)", async () => {
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: `${BASE_URL}/not-a-uuid/confirm`,
			...csrf,
		});

		expect(response.statusCode).toBe(400);
	});

	// ── Not found ───────────────────────────────────────────────

	it("returns 404 when no organizer profile exists", async () => {
		mockGetOrganizerByUserId.mockResolvedValue(null);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "POST",
			url: CONFIRM_URL,
			...csrf,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});
});

// ── Tests: GET /api/v1/organizers/documents ──────────────────────

describe("GET /api/v1/organizers/documents", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		setupOrganizerSession(app);
		mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
	});

	// ── Happy path ──────────────────────────────────────────────

	it("returns 200 with empty array when no documents", async () => {
		mockListVerificationDocuments.mockResolvedValue([]);

		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: [],
		});
	});

	it("returns 200 with documents list", async () => {
		mockListVerificationDocuments.mockResolvedValue([mockDocumentRecord]);

		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: [mockDocumentRecord],
		});
	});

	// ── Authentication ──────────────────────────────────────────

	it("returns 401 when no session", async () => {
		getSessionRedisMock(app).mockReset();

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

	// ── Authorization ───────────────────────────────────────────

	it("returns 403 when participant role", async () => {
		setupParticipantSession(app);

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

	// ── Not found ───────────────────────────────────────────────

	it("returns 404 when no organizer profile exists", async () => {
		mockGetOrganizerByUserId.mockResolvedValue(null);

		const response = await app.inject({
			method: "GET",
			url: BASE_URL,
			cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});
});

// ── Tests: DELETE /api/v1/organizers/documents/:documentId ───────

describe("DELETE /api/v1/organizers/documents/:documentId", () => {
	let app: FastifyInstance;
	const DELETE_URL = `${BASE_URL}/${TEST_DOCUMENT_ID}`;

	beforeAll(async () => {
		app = await buildTestApp();
		enableStorage(app);
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		setupOrganizerSession(app);
		mockGetOrganizerByUserId.mockResolvedValue(mockOrganizerProfile);
	});

	// ── Happy path ──────────────────────────────────────────────

	it("returns 200 on successful delete", async () => {
		mockDeleteVerificationDocument.mockResolvedValue(undefined);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "DELETE",
			url: DELETE_URL,
			...csrf,
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			success: true,
			data: { deleted: true },
		});
	});

	// ── Authentication ──────────────────────────────────────────

	it("returns 401 when no session", async () => {
		getSessionRedisMock(app).mockReset();

		const response = await app.inject({
			method: "DELETE",
			url: DELETE_URL,
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "UNAUTHORIZED" },
		});
	});

	// ── Authorization ───────────────────────────────────────────

	it("returns 403 when participant role", async () => {
		setupParticipantSession(app);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "DELETE",
			url: DELETE_URL,
			...csrf,
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "INSUFFICIENT_ROLE" },
		});
	});

	// ── Not found ───────────────────────────────────────────────

	it("returns 404 when no organizer profile exists", async () => {
		mockGetOrganizerByUserId.mockResolvedValue(null);
		const csrf = buildCsrfHeaders();

		const response = await app.inject({
			method: "DELETE",
			url: DELETE_URL,
			...csrf,
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toMatchObject({
			success: false,
			error: { code: "NOT_FOUND" },
		});
	});
});
