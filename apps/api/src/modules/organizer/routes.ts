import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { createAuditLogger } from "../../lib/audit.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import {
	confirmDocumentUpload,
	deleteVerificationDocument,
	listVerificationDocuments,
	requestDocumentUpload,
} from "./document-service.js";
import { acceptPolicies, getPolicyStatus } from "./policy-service.js";
import {
	acceptPoliciesBodySchema,
	acceptPoliciesResponseSchema,
	documentConfirmParamsSchema,
	documentConfirmResponseSchema,
	documentDeleteParamsSchema,
	documentDeleteResponseSchema,
	documentListResponseSchema,
	documentUploadBodySchema,
	documentUploadResponseSchema,
	getOrganizerResponseSchema,
	getPoliciesResponseSchema,
	organizerConflictResponseSchema,
	organizerErrorResponseSchema,
	organizerNotFoundResponseSchema,
	registerOrganizerBodySchema,
	registerOrganizerResponseSchema,
} from "./schemas.js";
import { getOrganizerByUserId, registerOrganizer } from "./service.js";

const organizerRoutes: FastifyPluginAsync = async (app) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	/**
	 * POST /api/v1/organizers — Register a new organizer profile.
	 *
	 * Requires authenticated user with at least 'organizer' role
	 * (granted after email verification in Phase 0).
	 */
	typedApp.post(
		"/",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				body: registerOrganizerBodySchema,
				response: {
					201: registerOrganizerResponseSchema,
					400: organizerErrorResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					409: organizerConflictResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const profile = await registerOrganizer(
				{ db: app.db, log: request.log },
				request.session!.userId,
				request.body,
			);

			reply.code(201);
			return { success: true as const, data: profile };
		},
	);

	/**
	 * GET /api/v1/organizers/me — Get the authenticated user's organizer profile.
	 *
	 * Requires authenticated user with at least 'organizer' role.
	 */
	typedApp.get(
		"/me",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				response: {
					200: getOrganizerResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerNotFoundResponseSchema,
				},
			},
		},
		async (request) => {
			const profile = await getOrganizerByUserId(
				app.db,
				request.session!.userId,
			);

			if (!profile) {
				throw new NotFoundError("Organizer profile not found");
			}

			return { success: true as const, data: profile };
		},
	);
	/**
	 * POST /api/v1/organizers/policies — Accept one or more organizer policies.
	 */
	typedApp.post(
		"/policies",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				body: acceptPoliciesBodySchema,
				response: {
					200: acceptPoliciesResponseSchema,
					400: organizerErrorResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const status = await acceptPolicies(
				{ db: app.db, log: request.log },
				request.session!.userId,
				request.body.policies,
				request.ip,
			);

			return { success: true as const, data: status };
		},
	);

	/**
	 * GET /api/v1/organizers/policies — Get policy acceptance status.
	 */
	typedApp.get(
		"/policies",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				response: {
					200: getPoliciesResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const status = await getPolicyStatus(app.db, request.session!.userId);

			return { success: true as const, data: status };
		},
	);

	// ── Document upload routes ───────────────────────────────────────

	/**
	 * POST /api/v1/organizers/documents/upload-url
	 * Request a presigned URL for uploading a verification document.
	 */
	typedApp.post(
		"/documents/upload-url",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				body: documentUploadBodySchema,
				response: {
					200: documentUploadResponseSchema,
					400: organizerErrorResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerErrorResponseSchema,
				},
			},
		},
		async (request) => {
			if (!app.storage.enabled) {
				throw new ValidationError(
					"Document upload is not available at this time",
				);
			}

			const organizer = await getOrganizerByUserId(
				app.db,
				request.session!.userId,
			);
			if (!organizer) {
				throw new NotFoundError(
					"Organizer profile not found. Please register first.",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await requestDocumentUpload(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				organizer.id,
				request.session!.userId,
				request.body,
				request.ip,
			);

			return { success: true as const, data: result };
		},
	);

	/**
	 * POST /api/v1/organizers/documents/:documentId/confirm
	 * Confirm that a document has been uploaded to S3.
	 */
	typedApp.post(
		"/documents/:documentId/confirm",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: documentConfirmParamsSchema,
				response: {
					200: documentConfirmResponseSchema,
					400: organizerErrorResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerErrorResponseSchema,
				},
			},
		},
		async (request) => {
			if (!app.storage.enabled) {
				throw new ValidationError(
					"Document upload is not available at this time",
				);
			}

			const organizer = await getOrganizerByUserId(
				app.db,
				request.session!.userId,
			);
			if (!organizer) {
				throw new NotFoundError(
					"Organizer profile not found. Please register first.",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await confirmDocumentUpload(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				organizer.id,
				request.session!.userId,
				request.params.documentId,
				request.ip,
			);

			return { success: true as const, data: result };
		},
	);

	/**
	 * GET /api/v1/organizers/documents
	 * List active verification documents for the authenticated organizer.
	 */
	typedApp.get(
		"/documents",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				response: {
					200: documentListResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const organizer = await getOrganizerByUserId(
				app.db,
				request.session!.userId,
			);
			if (!organizer) {
				throw new NotFoundError(
					"Organizer profile not found. Please register first.",
				);
			}

			const documents = await listVerificationDocuments(app.db, organizer.id);

			return { success: true as const, data: documents };
		},
	);

	/**
	 * DELETE /api/v1/organizers/documents/:documentId
	 * Delete a verification document.
	 */
	typedApp.delete(
		"/documents/:documentId",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				params: documentDeleteParamsSchema,
				response: {
					200: documentDeleteResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerErrorResponseSchema,
				},
			},
		},
		async (request) => {
			if (!app.storage.enabled) {
				throw new ValidationError(
					"Document upload is not available at this time",
				);
			}

			const organizer = await getOrganizerByUserId(
				app.db,
				request.session!.userId,
			);
			if (!organizer) {
				throw new NotFoundError(
					"Organizer profile not found. Please register first.",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			await deleteVerificationDocument(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				organizer.id,
				request.session!.userId,
				request.params.documentId,
				request.ip,
			);

			return { success: true as const, data: { deleted: true as const } };
		},
	);
};

export default organizerRoutes;
