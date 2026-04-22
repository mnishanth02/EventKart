import { describe, expect, it } from "vitest";
import {
	auditLog,
	consentRecords,
	consentTypeEnum,
	sessions,
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
});
