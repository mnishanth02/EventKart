import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@repo/shared/constants";
import type { FastifyPluginAsync } from "fastify";
import { createAuditLogger } from "../../lib/audit.js";
import { ValidationError } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import {
	adminErrorResponseSchema,
	approveBodySchema,
	documentViewParamsSchema,
	documentViewUrlResponseSchema,
	listVerificationsQuerySchema,
	listVerificationsResponseSchema,
	organizerIdParamsSchema,
	rejectBodySchema,
	reviewActionResponseSchema,
	verificationDetailResponseSchema,
} from "./schemas.js";
import {
	approveOrganizer,
	getDocumentViewUrl,
	getVerificationDetail,
	listVerifications,
	rejectOrganizer,
} from "./verification-service.js";

const adminRoutes: FastifyPluginAsync = async (app) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();
	const auditLogger = createAuditLogger(app.db, app.log);

	/**
	 * GET /api/v1/admin/verifications — List organizer verifications (paginated).
	 */
	typedApp.get(
		"/verifications",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				querystring: listVerificationsQuerySchema,
				response: {
					200: listVerificationsResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
				},
			},
		},
		// @ts-expect-error — ZodCoercedNumber + ZodTypeProvider handler type mismatch (pre-existing drizzle-orm duplicate types issue)
		async (request) => {
			const result = await listVerifications(app.db, request.query);
			return { success: true as const, data: result.data, meta: result.meta };
		},
	);

	/**
	 * GET /api/v1/admin/verifications/:organizerId — Verification detail.
	 */
	typedApp.get(
		"/verifications/:organizerId",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				params: organizerIdParamsSchema,
				response: {
					200: verificationDetailResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
					404: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const detail = await getVerificationDetail(
				app.db,
				request.params.organizerId,
			);
			return { success: true as const, data: detail };
		},
	);

	/**
	 * GET /api/v1/admin/verifications/:organizerId/documents/:documentId/view-url
	 * Get a presigned download URL for a verification document.
	 */
	typedApp.get(
		"/verifications/:organizerId/documents/:documentId/view-url",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				params: documentViewParamsSchema,
				response: {
					200: documentViewUrlResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
					404: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			if (!app.storage.enabled) {
				throw new ValidationError(
					"Document viewing is not available at this time",
				);
			}

			const result = await getDocumentViewUrl(
				app.storage,
				app.db,
				request.params.organizerId,
				request.params.documentId,
			);

			// Audit document access (fire-and-forget — acceptable for reads)
			void auditLogger.log({
				actorId: request.session!.userId,
				actorRole: "admin",
				action: AUDIT_ACTIONS.ORGANIZER_DOCUMENT_VIEW,
				resourceType: AUDIT_RESOURCE_TYPES.DOCUMENT,
				resourceId: request.params.documentId,
				metadata: {
					organizerId: request.params.organizerId,
					documentType: result.documentType,
				},
				ipAddress: request.ip,
			});

			return { success: true as const, data: result };
		},
	);

	/**
	 * POST /api/v1/admin/verifications/:organizerId/approve — Approve organizer.
	 * CSRF validated automatically by the csrf plugin for POST requests.
	 */
	typedApp.post(
		"/verifications/:organizerId/approve",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				params: organizerIdParamsSchema,
				body: approveBodySchema,
				response: {
					200: reviewActionResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
					404: adminErrorResponseSchema,
					409: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const result = await approveOrganizer(
				app.db,
				request.log,
				request.session!.userId,
				request.params.organizerId,
				request.ip,
				request.body.notes,
			);
			return { success: true as const, data: result };
		},
	);

	/**
	 * POST /api/v1/admin/verifications/:organizerId/reject — Reject organizer.
	 * CSRF validated automatically by the csrf plugin for POST requests.
	 */
	typedApp.post(
		"/verifications/:organizerId/reject",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				params: organizerIdParamsSchema,
				body: rejectBodySchema,
				response: {
					200: reviewActionResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
					404: adminErrorResponseSchema,
					409: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const result = await rejectOrganizer(
				app.db,
				request.log,
				request.session!.userId,
				request.params.organizerId,
				request.body.reason,
				request.ip,
			);
			return { success: true as const, data: result };
		},
	);
};

export default adminRoutes;
