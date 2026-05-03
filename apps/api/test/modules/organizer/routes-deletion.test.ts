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
const mockPreviewOrganizerDeletion = vi.fn();
const mockDeleteOrganizerAccount = vi.fn();
const mockRunDeletionSideEffects = vi.fn();

vi.mock("../../../src/modules/organizer/deletion-service.js", () => ({
	previewOrganizerDeletion: (...args: unknown[]) =>
		mockPreviewOrganizerDeletion(...args),
	deleteOrganizerAccount: (...args: unknown[]) =>
		mockDeleteOrganizerAccount(...args),
	runDeletionSideEffects: (...args: unknown[]) =>
		mockRunDeletionSideEffects(...args),
}));

// Mock other organizer services to avoid import side effects
vi.mock("../../../src/modules/organizer/service.js", () => ({
	registerOrganizer: vi.fn(),
	getOrganizerByUserId: vi.fn(),
	updateOrganizer: vi.fn(),
}));

vi.mock("../../../src/modules/organizer/document-service.js", () => ({
	requestDocumentUpload: vi.fn(),
	confirmDocumentUpload: vi.fn(),
	deleteVerificationDocument: vi.fn(),
	listVerificationDocuments: vi.fn(),
	maybeUpdateOrganizerVerificationStatus: vi.fn(),
}));

vi.mock("../../../src/modules/organizer/policy-service.js", () => ({
	acceptPolicies: vi.fn(),
	getPolicyStatus: vi.fn(),
}));

vi.mock("../../../src/modules/organizer/public-profile-service.js", () => ({
	lookupPublicOrganizerBySlug: vi.fn(),
}));

vi.mock("../../../src/modules/organizer/next-event-service.js", () => ({
	organizerExistsById: vi.fn(),
	selectOrganizerNextEvent: vi.fn(),
}));

vi.mock("../../../src/modules/organizer/verification-status-service.js", () => ({
	getVerificationStatus: vi.fn(),
}));

import type { FastifyInstance } from "fastify";
import { NotFoundError } from "../../../src/lib/errors.js";
import { generateCsrfToken } from "../../../src/plugins/csrf.js";
import { buildTestApp } from "../../helpers/build-app.js";

// ── Constants ────────────────────────────────────────────────────
const PREVIEW_URL = "/api/v1/organizers/me/deletion-preview";
const DELETE_URL = "/api/v1/organizers/me/delete";
const SESSION_COOKIE_NAME = "kiran_session";
const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TEST_SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_CSRF_SECRET = "eventkart-csrf-secret-v1";

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

// ── Tests ────────────────────────────────────────────────────────

describe("Organizer deletion routes", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = await buildTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		getSessionRedisMock(app).mockReset();
		mockPreviewOrganizerDeletion.mockReset();
		mockDeleteOrganizerAccount.mockReset();
		mockRunDeletionSideEffects.mockReset();
	});

	// ── GET /me/deletion-preview ────────────────────────────────

	describe("GET /api/v1/organizers/me/deletion-preview", () => {
		it("returns 401 without session cookie", async () => {
			const response = await app.inject({
				method: "GET",
				url: PREVIEW_URL,
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "UNAUTHORIZED" },
			});
		});

		it("returns 403 with non-organizer role (participant)", async () => {
			setupParticipantSession(app);

			const response = await app.inject({
				method: "GET",
				url: PREVIEW_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "INSUFFICIENT_ROLE" },
			});
		});

		it("returns correct preview shape", async () => {
			setupOrganizerSession(app);
			const futureDate = new Date(Date.now() + 86_400_000);
			mockPreviewOrganizerDeletion.mockResolvedValue({
				businessName: "Test Org",
				futureEvents: [
					{
						id: "ev-1",
						slug: "future-event",
						title: "Future Event",
						startAt: futureDate,
						status: "published",
					},
				],
				preservedEventCount: 2,
				hasRazorpayAccount: true,
				kycDocumentCount: 3,
			});

			const response = await app.inject({
				method: "GET",
				url: PREVIEW_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.success).toBe(true);
			expect(body.data.businessName).toBe("Test Org");
			expect(body.data.futureEvents).toHaveLength(1);
			expect(body.data.futureEvents[0].slug).toBe("future-event");
			expect(body.data.futureEvents[0].startAt).toBe(
				futureDate.toISOString(),
			);
			expect(body.data.preservedEventCount).toBe(2);
			expect(body.data.hasRazorpayAccount).toBe(true);
			expect(body.data.kycDocumentCount).toBe(3);
		});

		it("includes Cache-Control: private, no-store header", async () => {
			setupOrganizerSession(app);
			mockPreviewOrganizerDeletion.mockResolvedValue({
				businessName: "Test",
				futureEvents: [],
				preservedEventCount: 0,
				hasRazorpayAccount: false,
				kycDocumentCount: 0,
			});

			const response = await app.inject({
				method: "GET",
				url: PREVIEW_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["cache-control"]).toBe("private, no-store");
		});

		it("returns 404 when organizer not found", async () => {
			setupOrganizerSession(app);
			mockPreviewOrganizerDeletion.mockRejectedValue(
				new NotFoundError("Organizer profile not found"),
			);

			const response = await app.inject({
				method: "GET",
				url: PREVIEW_URL,
				cookies: { [SESSION_COOKIE_NAME]: TEST_SESSION_ID },
			});

			expect(response.statusCode).toBe(404);
		});
	});

	// ── POST /me/delete ─────────────────────────────────────────

	describe("POST /api/v1/organizers/me/delete", () => {
		it("returns 401 without session cookie", async () => {
			const response = await app.inject({
				method: "POST",
				url: DELETE_URL,
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "UNAUTHORIZED" },
			});
		});

		it("returns 403 with non-organizer role (participant)", async () => {
			setupParticipantSession(app);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: DELETE_URL,
				...csrf,
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toMatchObject({
				success: false,
				error: { code: "INSUFFICIENT_ROLE" },
			});
		});

		it("returns correct deletion response shape", async () => {
			setupOrganizerSession(app);
			mockDeleteOrganizerAccount.mockResolvedValue({
				organizerSlug: "test-org",
				deletedEventSlugs: ["ev-1"],
				preservedEventSlugs: ["ev-2"],
				deletedEventCount: 1,
				preservedEventCount: 1,
				sessionIds: ["sess-1"],
				storageKeys: [],
				razorpayAccountId: null,
			});
			mockRunDeletionSideEffects.mockResolvedValue(undefined);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: DELETE_URL,
				...csrf,
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.success).toBe(true);
			expect(body.data).toMatchObject({
				message: "Organizer account deleted successfully",
				deletedEventCount: 1,
				preservedEventCount: 1,
			});
		});

		it("response includes Set-Cookie headers clearing session and CSRF cookies", async () => {
			setupOrganizerSession(app);
			mockDeleteOrganizerAccount.mockResolvedValue({
				organizerSlug: "test-org",
				deletedEventSlugs: [],
				preservedEventSlugs: [],
				deletedEventCount: 0,
				preservedEventCount: 0,
				sessionIds: [],
				storageKeys: [],
				razorpayAccountId: null,
			});
			mockRunDeletionSideEffects.mockResolvedValue(undefined);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: DELETE_URL,
				...csrf,
			});

			expect(response.statusCode).toBe(200);
			const setCookieHeaders = response.headers["set-cookie"];
			const cookieArray = Array.isArray(setCookieHeaders)
				? setCookieHeaders
				: [setCookieHeaders];

			// Should clear both session and CSRF cookies
			const sessionClearCookie = cookieArray.find((c) =>
				c?.includes(SESSION_COOKIE_NAME),
			);
			const csrfClearCookie = cookieArray.find((c) =>
				c?.includes(CSRF_COOKIE_NAME),
			);

			expect(sessionClearCookie).toBeDefined();
			expect(csrfClearCookie).toBeDefined();
		});

		it("includes Cache-Control: private, no-store header", async () => {
			setupOrganizerSession(app);
			mockDeleteOrganizerAccount.mockResolvedValue({
				organizerSlug: "test-org",
				deletedEventSlugs: [],
				preservedEventSlugs: [],
				deletedEventCount: 0,
				preservedEventCount: 0,
				sessionIds: [],
				storageKeys: [],
				razorpayAccountId: null,
			});
			mockRunDeletionSideEffects.mockResolvedValue(undefined);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: DELETE_URL,
				...csrf,
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["cache-control"]).toBe("private, no-store");
		});

		it("returns 404 when organizer already deleted", async () => {
			setupOrganizerSession(app);
			mockDeleteOrganizerAccount.mockRejectedValue(
				new NotFoundError(
					"Organizer profile not found or already deleted",
				),
			);
			const csrf = buildCsrfHeaders();

			const response = await app.inject({
				method: "POST",
				url: DELETE_URL,
				...csrf,
			});

			expect(response.statusCode).toBe(404);
		});

		it("calls runDeletionSideEffects after successful deletion", async () => {
			setupOrganizerSession(app);
			const txResult = {
				organizerSlug: "test-org",
				deletedEventSlugs: ["ev-1"],
				preservedEventSlugs: [],
				deletedEventCount: 1,
				preservedEventCount: 0,
				sessionIds: ["sess-1"],
				storageKeys: ["key1"],
				razorpayAccountId: null,
			};
			mockDeleteOrganizerAccount.mockResolvedValue(txResult);
			mockRunDeletionSideEffects.mockResolvedValue(undefined);
			const csrf = buildCsrfHeaders();

			await app.inject({
				method: "POST",
				url: DELETE_URL,
				...csrf,
			});

			expect(mockRunDeletionSideEffects).toHaveBeenCalledTimes(1);
			expect(mockRunDeletionSideEffects).toHaveBeenCalledWith(
				expect.objectContaining({
					log: expect.anything(),
					redis: expect.objectContaining({
						session: expect.anything(),
						cache: expect.anything(),
					}),
					storage: expect.anything(),
				}),
				txResult,
			);
		});
	});
});
