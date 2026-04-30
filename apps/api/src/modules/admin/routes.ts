import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@repo/shared/constants";
import type { FastifyPluginAsync } from "fastify";
import { createAuditLogger } from "../../lib/audit.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import {
	approveEventReview,
	getEventReviewDetail,
	listEventReviews,
	rejectEventReview,
} from "./event-review-service.js";
import {
	adminErrorResponseSchema,
	approveBodySchema,
	approveEventReviewBodySchema,
	documentViewParamsSchema,
	documentViewUrlResponseSchema,
	eventReviewActionResponseSchema,
	eventReviewDetailResponseSchema,
	eventReviewIdParamsSchema,
	listEventReviewsQuerySchema,
	listEventReviewsResponseSchema,
	listVerificationsQuerySchema,
	listVerificationsResponseSchema,
	organizerIdParamsSchema,
	rejectBodySchema,
	rejectEventReviewBodySchema,
	retryRazorpayResponseSchema,
	reviewActionResponseSchema,
	verificationDetailResponseSchema,
} from "./schemas.js";
import {
	approveOrganizer,
	getDocumentViewUrl,
	getVerificationDetail,
	listVerifications,
	rejectOrganizer,
	retryRazorpayAccount,
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
		async (request) => {
			const result = await listVerifications(app.db, request.query);
			return { success: true as const, data: result.data, meta: result.meta };
		},
	);

	/**
	 * GET /api/v1/admin/event-reviews — List events awaiting admin review.
	 */
	typedApp.get(
		"/event-reviews",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				querystring: listEventReviewsQuerySchema,
				response: {
					200: listEventReviewsResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const result = await listEventReviews(app.db, request.query);
			return { success: true as const, data: result.data, meta: result.meta };
		},
	);

	/**
	 * GET /api/v1/admin/event-reviews/:eventId — Event review detail.
	 */
	typedApp.get(
		"/event-reviews/:eventId",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				params: eventReviewIdParamsSchema,
				response: {
					200: eventReviewDetailResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
					404: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const detail = await getEventReviewDetail(app.db, request.params.eventId);
			return { success: true as const, data: detail };
		},
	);

	/**
	 * POST /api/v1/admin/event-reviews/:eventId/approve — Approve an event.
	 */
	typedApp.post(
		"/event-reviews/:eventId/approve",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				params: eventReviewIdParamsSchema,
				body: approveEventReviewBodySchema,
				response: {
					200: eventReviewActionResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
					404: adminErrorResponseSchema,
					409: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}
			const result = await approveEventReview(
				{
					db: app.db,
					log: request.log,
					auditLogger,
					cache: app.redis.cache,
					sitemapRegenQueue: app.queues.sitemapRegen,
				},
				request.params.eventId,
				session.userId,
				request.ip,
				request.body.notes,
			);
			return { success: true as const, data: result };
		},
	);

	/**
	 * POST /api/v1/admin/event-reviews/:eventId/reject — Reject an event.
	 */
	typedApp.post(
		"/event-reviews/:eventId/reject",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				params: eventReviewIdParamsSchema,
				body: rejectEventReviewBodySchema,
				response: {
					200: eventReviewActionResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
					404: adminErrorResponseSchema,
					409: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}
			const result = await rejectEventReview(
				{
					db: app.db,
					log: request.log,
					auditLogger,
					sitemapRegenQueue: app.queues.sitemapRegen,
				},
				request.params.eventId,
				session.userId,
				request.body.reason,
				request.ip,
			);
			return { success: true as const, data: result };
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
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}
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
				actorId: session.userId,
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
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}
			const result = await approveOrganizer(
				app.db,
				request.log,
				session.userId,
				request.params.organizerId,
				request.ip,
				request.body.notes,
				app.queues,
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
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}
			const result = await rejectOrganizer(
				app.db,
				request.log,
				session.userId,
				request.params.organizerId,
				request.body.reason,
				request.ip,
			);
			return { success: true as const, data: result };
		},
	);

	/**
	 * POST /api/v1/admin/verifications/:organizerId/retry-razorpay
	 * Retry Razorpay linked account creation for a failed/needs_action organizer.
	 */
	typedApp.post(
		"/verifications/:organizerId/retry-razorpay",
		{
			preHandler: [requireAuth, requireRole("admin")],
			schema: {
				params: organizerIdParamsSchema,
				response: {
					200: retryRazorpayResponseSchema,
					401: adminErrorResponseSchema,
					403: adminErrorResponseSchema,
					404: adminErrorResponseSchema,
					409: adminErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const session = request.session;
			if (!session) {
				throw new UnauthorizedError();
			}
			const result = await retryRazorpayAccount(
				app.db,
				request.log,
				request.params.organizerId,
				app.queues,
				session.userId,
				request.ip,
			);
			return { success: true as const, data: result };
		},
	);
};

export default adminRoutes;
