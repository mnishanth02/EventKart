import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
	AUDIT_ACTIONS,
	AUDIT_RESOURCE_TYPES,
	CSRF_COOKIE_NAME,
	SESSION_COOKIE_NAME,
} from "@repo/shared/constants";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { createAuditLogger } from "../../lib/audit.js";
import {
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../../lib/errors.js";
import { buildSessionCookieOptions } from "../../lib/session.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireInternal } from "../../middleware/require-internal.js";
import { requireRole } from "../../middleware/require-role.js";
import { buildCsrfClearOptions } from "../../plugins/csrf.js";
import {
	deleteOrganizerAccount,
	previewOrganizerDeletion,
	runDeletionSideEffects,
} from "./deletion-service.js";
import {
	confirmDocumentUpload,
	deleteVerificationDocument,
	listVerificationDocuments,
	maybeUpdateOrganizerVerificationStatus,
	requestDocumentUpload,
} from "./document-service.js";
import {
	organizerExistsById,
	selectOrganizerNextEvent,
} from "./next-event-service.js";
import { acceptPolicies, getPolicyStatus } from "./policy-service.js";
import { lookupPublicOrganizerBySlug } from "./public-profile-service.js";
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
	getVerificationStatusResponseSchema,
	organizerConflictResponseSchema,
	organizerDeletionPreviewResponseSchema,
	organizerDeletionResponseSchema,
	organizerErrorResponseSchema,
	organizerIdParamsSchema,
	organizerNextEventResponseSchema,
	organizerNotFoundResponseSchema,
	organizerPublicLookupHttpResponseSchema,
	organizerSlugParamsSchema,
	registerOrganizerBodySchema,
	registerOrganizerResponseSchema,
	updateOrganizerBodySchema,
	updateOrganizerResponseSchema,
} from "./schemas.js";
import {
	getOrganizerByUserId,
	registerOrganizer,
	updateOrganizer,
} from "./service.js";
import { getVerificationStatus } from "./verification-status-service.js";

function getAuthenticatedSession(request: FastifyRequest) {
	const session = request.session;
	if (!session) {
		throw new UnauthorizedError();
	}

	return session;
}

const organizerRoutes: FastifyPluginAsync = async (app) => {
	const typedApp = app.withTypeProvider<ZodTypeProvider>();

	/**
	 * GET /api/v1/organizers/by-slug/:slug — Public organizer profile lookup.
	 *
	 * Anonymous (no preHandler). Mirrors `GET /api/v1/events/by-slug/:slug`:
	 * returns either `{ kind: "organizer", data }` or
	 * `{ kind: "redirect", newSlug }` so loaders can share control flow.
	 *
	 * The Fastify response schema strips any out-of-shape fields at the
	 * framework boundary as a defense-in-depth layer on top of the
	 * in-service `.parse` projection.
	 */
	typedApp.get(
		"/by-slug/:slug",
		{
			schema: {
				params: organizerSlugParamsSchema,
				response: {
					200: organizerPublicLookupHttpResponseSchema,
					400: organizerErrorResponseSchema,
					404: organizerErrorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const data = await lookupPublicOrganizerBySlug(
				app.db,
				request.params.slug,
				request.log,
				app.redis.cache,
			);

			// I-2.4.6: Mirror the events redirect-cache directive — short
			// `max-age=300` (no `s-maxage`/SWR) so the CDN can't pin a
			// stale slug rename through a follow-up rename.
			if (data.kind === "redirect") {
				reply.header("cache-control", "public, max-age=300");
			}

			return { success: true as const, data };
		},
	);

	/**
	 * GET /api/v1/organizers/:organizerId/next-event — Same-organizer
	 * next-event lookup (I-2.3.6).
	 *
	 * Internal-only (requires `x-internal-key`). Used by the I-6.2.3
	 * post-event follow-up email worker to populate the "your next
	 * event from this organizer" prompt. Returns the organizer's
	 * immediate next published event (`endAt > now`, ordered by
	 * `startAt ASC`) as an `EventPublicCard`, or `data: null` when the
	 * organizer has no upcoming event.
	 *
	 * The route checks organizer existence first so a missing
	 * organizer surfaces as **404** rather than `data: null` — that
	 * distinction matters for the email worker (typo vs. legitimate
	 * empty state).
	 *
	 * URL uses the organizer UUID (not slug) per I-2.3.1 D1: organizer
	 * IDs are not exposed publicly, so this surface is reachable only
	 * by internal callers that already hold the UUID.
	 */
	typedApp.get(
		"/:organizerId/next-event",
		{
			preHandler: [requireInternal],
			schema: {
				params: organizerIdParamsSchema,
				response: {
					200: organizerNextEventResponseSchema,
					400: organizerErrorResponseSchema,
					401: organizerErrorResponseSchema,
					404: organizerErrorResponseSchema,
				},
			},
		},
		async (request) => {
			const exists = await organizerExistsById(
				app.db,
				request.params.organizerId,
			);
			if (!exists) {
				throw new NotFoundError("Organizer not found");
			}

			const data = await selectOrganizerNextEvent(
				{ db: app.db, storage: app.storage, log: request.log },
				{ organizerId: request.params.organizerId, now: new Date() },
			);

			return { success: true as const, data };
		},
	);

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
			const session = getAuthenticatedSession(request);
			const profile = await registerOrganizer(
				{ db: app.db, log: request.log },
				session.userId,
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
			const session = getAuthenticatedSession(request);
			const profile = await getOrganizerByUserId(app.db, session.userId);

			if (!profile) {
				throw new NotFoundError("Organizer profile not found");
			}

			return { success: true as const, data: profile };
		},
	);

	/**
	 * GET /api/v1/organizers/verification-status — Get comprehensive verification progress.
	 *
	 * Returns aggregated status including document progress, policy status,
	 * SLA tracking, and review information.
	 */
	typedApp.get(
		"/verification-status",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				response: {
					200: getVerificationStatusResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerNotFoundResponseSchema,
				},
			},
		},
		async (request) => {
			const session = getAuthenticatedSession(request);
			const profile = await getOrganizerByUserId(app.db, session.userId);

			if (!profile) {
				throw new NotFoundError("Organizer profile not found");
			}

			const status = await getVerificationStatus(
				app.db,
				session.userId,
				profile.id,
			);

			return { success: true as const, data: status };
		},
	);

	/**
	 * PUT /api/v1/organizers/me — Update the authenticated user's organizer profile.
	 */
	typedApp.put(
		"/me",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				body: updateOrganizerBodySchema,
				response: {
					200: updateOrganizerResponseSchema,
					400: organizerErrorResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerNotFoundResponseSchema,
				},
			},
		},
		async (request) => {
			const session = getAuthenticatedSession(request);
			if (!Object.values(request.body).some((v) => v !== undefined)) {
				throw new ValidationError(
					"At least one field must be provided for update",
				);
			}

			const profile = await updateOrganizer(
				{ db: app.db, log: request.log },
				session.userId,
				request.body,
			);

			if (!profile) {
				throw new NotFoundError("Organizer profile not found");
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			await auditLogger.log({
				action: AUDIT_ACTIONS.ORGANIZER_PROFILE_UPDATE,
				actorId: session.userId,
				resourceType: AUDIT_RESOURCE_TYPES.ORGANIZER,
				resourceId: profile.id,
				ipAddress: request.ip,
				metadata: { updatedFields: Object.keys(request.body) },
			});

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
			const session = getAuthenticatedSession(request);
			const status = await acceptPolicies(
				{ db: app.db, log: request.log },
				session.userId,
				request.body.policies,
				request.ip,
			);

			// Re-evaluate verification status after policy acceptance
			// (handles the case where docs were uploaded first, then policies accepted)
			const organizer = await getOrganizerByUserId(app.db, session.userId);
			if (organizer) {
				await maybeUpdateOrganizerVerificationStatus(
					app.db,
					organizer.id,
					request.log,
				);
			}

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
			const session = getAuthenticatedSession(request);
			const status = await getPolicyStatus(app.db, session.userId);

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
			const session = getAuthenticatedSession(request);
			if (!app.storage.enabled) {
				throw new ValidationError(
					"Document upload is not available at this time",
				);
			}

			const organizer = await getOrganizerByUserId(app.db, session.userId);
			if (!organizer) {
				throw new NotFoundError(
					"Organizer profile not found. Please register first.",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await requestDocumentUpload(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				organizer.id,
				session.userId,
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
			const session = getAuthenticatedSession(request);
			if (!app.storage.enabled) {
				throw new ValidationError(
					"Document upload is not available at this time",
				);
			}

			const organizer = await getOrganizerByUserId(app.db, session.userId);
			if (!organizer) {
				throw new NotFoundError(
					"Organizer profile not found. Please register first.",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			const result = await confirmDocumentUpload(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				organizer.id,
				session.userId,
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
			const session = getAuthenticatedSession(request);
			const organizer = await getOrganizerByUserId(app.db, session.userId);
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
			const session = getAuthenticatedSession(request);
			if (!app.storage.enabled) {
				throw new ValidationError(
					"Document upload is not available at this time",
				);
			}

			const organizer = await getOrganizerByUserId(app.db, session.userId);
			if (!organizer) {
				throw new NotFoundError(
					"Organizer profile not found. Please register first.",
				);
			}

			const auditLogger = createAuditLogger(app.db, request.log);
			await deleteVerificationDocument(
				{ db: app.db, log: request.log, storage: app.storage, auditLogger },
				organizer.id,
				session.userId,
				request.params.documentId,
				request.ip,
			);

			return { success: true as const, data: { deleted: true as const } };
		},
	);

	// ── Account deletion routes ──────────────────────────────────────

	/**
	 * GET /api/v1/organizers/me/deletion-preview
	 * Preview what will be affected by deleting the organizer account.
	 */
	typedApp.get(
		"/me/deletion-preview",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				response: {
					200: organizerDeletionPreviewResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerErrorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const session = getAuthenticatedSession(request);
			const preview = await previewOrganizerDeletion(app.db, session.userId);

			const { futureEvents, ...rest } = preview;
			reply.header("Cache-Control", "private, no-store");
			return {
				success: true as const,
				data: {
					...rest,
					futureEvents: futureEvents.map((e) => ({
						id: e.id,
						slug: e.slug,
						title: e.title,
						startAt: e.startAt.toISOString(),
						status: e.status,
					})),
				},
			};
		},
	);

	/**
	 * POST /api/v1/organizers/me/delete
	 * Permanently delete the organizer account and associated data.
	 */
	typedApp.post(
		"/me/delete",
		{
			preHandler: [requireAuth, requireRole("organizer")],
			schema: {
				response: {
					200: organizerDeletionResponseSchema,
					401: organizerErrorResponseSchema,
					403: organizerErrorResponseSchema,
					404: organizerErrorResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const session = getAuthenticatedSession(request);
			const auditLogger = createAuditLogger(app.db, request.log);

			const txResult = await deleteOrganizerAccount(
				{ db: app.db, log: request.log, auditLogger },
				session.userId,
				{ ip: request.ip, sessionId: session.sessionId },
			);

			await runDeletionSideEffects(
				{
					log: request.log,
					redis: {
						session: app.redis.session,
						cache: app.redis.cache,
					},
					storage: app.storage,
					cdnPurgeQueue: app.queues.cdnPurge,
					...(app.config.CDN_BASE_URL
						? { cdnBaseUrl: app.config.CDN_BASE_URL }
						: {}),
					sitemapRegenQueue: app.queues.sitemapRegen,
				},
				txResult,
			);

			// Clear session cookie (mirror logout pattern)
			const { maxAge: _, ...clearOptions } = buildSessionCookieOptions(
				app.config.COOKIE_DOMAIN,
			);
			reply.clearCookie(SESSION_COOKIE_NAME, clearOptions);

			// Clear CSRF cookie
			reply.clearCookie(
				CSRF_COOKIE_NAME,
				buildCsrfClearOptions(app.config.COOKIE_DOMAIN),
			);

			reply.header("Cache-Control", "private, no-store");
			return {
				success: true as const,
				data: {
					message: "Organizer account deleted successfully",
					deletedEventCount: txResult.deletedEventCount,
					preservedEventCount: txResult.preservedEventCount,
				},
			};
		},
	);
};

export default organizerRoutes;
