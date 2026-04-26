import { describe, expect, it } from "vitest";
import {
	auditLog,
	consentRecords,
	consentTypeEnum,
	eventStatusEnum,
	events,
	sessions,
	slugRedirectResourceTypeEnum,
	slugRedirects,
	userRoleEnum,
	users,
} from "../src/schema/index.js";

describe("schema exports", () => {
	it("exports users table with expected columns", () => {
		expect(users).toBeDefined();
		expect(users.id).toBeDefined();
		expect(users.phone).toBeDefined();
		expect(users.email).toBeDefined();
		expect(users.name).toBeDefined();
		expect(users.role).toBeDefined();
		expect(users.createdAt).toBeDefined();
		expect(users.deletedAt).toBeDefined();
	});

	it("exports userRoleEnum with correct values", () => {
		expect(userRoleEnum).toBeDefined();
		expect(userRoleEnum.enumValues).toEqual([
			"public",
			"participant",
			"organizer",
			"admin",
		]);
	});

	it("exports sessions table with expected columns", () => {
		expect(sessions).toBeDefined();
		expect(sessions.id).toBeDefined();
		expect(sessions.userId).toBeDefined();
		expect(sessions.expiresAt).toBeDefined();
		expect(sessions.revokedAt).toBeDefined();
		expect(sessions.ipAddress).toBeDefined();
		expect(sessions.userAgent).toBeDefined();
		expect(sessions.createdAt).toBeDefined();
	});

	it("exports consentRecords table with expected columns", () => {
		expect(consentRecords).toBeDefined();
		expect(consentRecords.id).toBeDefined();
		expect(consentRecords.participantId).toBeDefined();
		expect(consentRecords.consentType).toBeDefined();
		expect(consentRecords.consentVersion).toBeDefined();
		expect(consentRecords.acceptedAt).toBeDefined();
		expect(consentRecords.withdrawnAt).toBeDefined();
		expect(consentRecords.ipAddress).toBeDefined();
	});

	it("exports consentTypeEnum with correct values", () => {
		expect(consentTypeEnum).toBeDefined();
		expect(consentTypeEnum.enumValues).toEqual([
			"booking_terms",
			"data_usage",
			"marketing",
			"platform_terms",
			"refund_policy",
		]);
	});

	it("exports auditLog table with expected columns", () => {
		expect(auditLog).toBeDefined();
		expect(auditLog.id).toBeDefined();
		expect(auditLog.actorId).toBeDefined();
		expect(auditLog.actorRole).toBeDefined();
		expect(auditLog.action).toBeDefined();
		expect(auditLog.resourceType).toBeDefined();
		expect(auditLog.resourceId).toBeDefined();
		expect(auditLog.metadata).toBeDefined();
		expect(auditLog.ipAddress).toBeDefined();
		expect(auditLog.createdAt).toBeDefined();
	});

	it("exports events table with expected columns", () => {
		expect(events).toBeDefined();
		expect(events.id).toBeDefined();
		expect(events.organizerId).toBeDefined();
		expect(events.title).toBeDefined();
		expect(events.slug).toBeDefined();
		expect(events.status).toBeDefined();
		expect(events.createdAt).toBeDefined();
		expect(events.updatedAt).toBeDefined();
	});

	it("exports eventStatusEnum with correct values", () => {
		expect(eventStatusEnum).toBeDefined();
		expect(eventStatusEnum.enumValues).toEqual([
			"draft",
			"under_review",
			"published",
			"completed",
			"cancelled",
		]);
	});

	it("exports slugRedirects table with expected columns", () => {
		expect(slugRedirects).toBeDefined();
		expect(slugRedirects.id).toBeDefined();
		expect(slugRedirects.oldSlug).toBeDefined();
		expect(slugRedirects.newSlug).toBeDefined();
		expect(slugRedirects.resourceType).toBeDefined();
		expect(slugRedirects.resourceId).toBeDefined();
		expect(slugRedirects.createdAt).toBeDefined();
	});

	it("exports slugRedirectResourceTypeEnum with correct values", () => {
		expect(slugRedirectResourceTypeEnum).toBeDefined();
		expect(slugRedirectResourceTypeEnum.enumValues).toEqual([
			"event",
			"organizer",
		]);
	});
});
