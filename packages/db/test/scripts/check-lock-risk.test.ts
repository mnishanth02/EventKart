import { describe, expect, it } from "vitest";
import { analyzeMigrationSQL } from "../../scripts/check-lock-risk.js";

describe("analyzeMigrationSQL", () => {
	it("returns no findings for safe migration SQL", () => {
		const sql = [
			`ALTER TABLE "events" ADD COLUMN "description" text;`,
			`CREATE INDEX CONCURRENTLY "events_title_idx" ON "events" ("title");`,
		].join("--> statement-breakpoint\n");

		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");
		expect(findings).toEqual([]);
	});

	it("detects ADD COLUMN NOT NULL without DEFAULT as CRITICAL", () => {
		const sql = `ALTER TABLE "events" ADD COLUMN "title" varchar(255) NOT NULL;`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(1);
		expect(findings[0]!.severity).toBe("CRITICAL");
		expect(findings[0]!.rule).toBe("not-null-without-default");
	});

	it("allows ADD COLUMN NOT NULL with DEFAULT", () => {
		const sql = `ALTER TABLE "events" ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'draft';`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toEqual([]);
	});

	it("allows ADD COLUMN nullable (no NOT NULL)", () => {
		const sql = `ALTER TABLE "events" ADD COLUMN "description" text;`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toEqual([]);
	});

	it("detects CREATE INDEX without CONCURRENTLY as CRITICAL", () => {
		const sql = `CREATE INDEX "events_date_idx" ON "events" ("date");`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(1);
		expect(findings[0]!.severity).toBe("CRITICAL");
		expect(findings[0]!.rule).toBe("index-not-concurrent");
	});

	it("skips CREATE INDEX CONCURRENTLY check for initial migration (0000_*)", () => {
		const sql = `CREATE INDEX "events_date_idx" ON "events" ("date");`;
		const findings = analyzeMigrationSQL(sql, "0000_initial_setup.sql");

		expect(findings).toEqual([]);
	});

	it("allows CREATE INDEX CONCURRENTLY", () => {
		const sql = `CREATE INDEX CONCURRENTLY "events_date_idx" ON "events" ("date");`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toEqual([]);
	});

	it("detects ALTER COLUMN TYPE as WARNING", () => {
		const sql = `ALTER TABLE "events" ALTER COLUMN "title" TYPE text;`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(1);
		expect(findings[0]!.severity).toBe("WARNING");
		expect(findings[0]!.rule).toBe("alter-column-type");
	});

	it("detects DROP COLUMN as WARNING", () => {
		const sql = `ALTER TABLE "events" DROP COLUMN "old_field";`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(1);
		expect(findings[0]!.severity).toBe("WARNING");
		expect(findings[0]!.rule).toBe("drop-column");
	});

	it("detects DROP TABLE as WARNING", () => {
		const sql = `DROP TABLE "old_events";`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(1);
		expect(findings[0]!.severity).toBe("WARNING");
		expect(findings[0]!.rule).toBe("drop-table");
	});

	it("detects ADD FOREIGN KEY without NOT VALID as CRITICAL", () => {
		const sql = `ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id");`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(1);
		expect(findings[0]!.severity).toBe("CRITICAL");
		expect(findings[0]!.rule).toBe("fk-without-not-valid");
	});

	it("allows ADD FOREIGN KEY with NOT VALID", () => {
		const sql = `ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") NOT VALID;`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toEqual([]);
	});

	it("detects LOCK TABLE as WARNING", () => {
		const sql = `LOCK TABLE "events" IN ACCESS EXCLUSIVE MODE;`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(1);
		expect(findings[0]!.severity).toBe("WARNING");
		expect(findings[0]!.rule).toBe("lock-table");
	});

	it("detects multiple findings in one file", () => {
		const sql = [
			`ALTER TABLE "events" ADD COLUMN "title" varchar(255) NOT NULL`,
			`CREATE INDEX "events_date_idx" ON "events" ("date")`,
			`ALTER TABLE "events" DROP COLUMN "old_field"`,
		].join(";\n--> statement-breakpoint\n");

		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(3);
		const rules = findings.map((f) => f.rule);
		expect(rules).toContain("not-null-without-default");
		expect(rules).toContain("index-not-concurrent");
		expect(rules).toContain("drop-column");
	});

	it("detects CREATE UNIQUE INDEX without CONCURRENTLY as CRITICAL", () => {
		const sql = `CREATE UNIQUE INDEX "events_slug_unique" ON "events" ("slug");`;
		const findings = analyzeMigrationSQL(sql, "0001_add_events.sql");

		expect(findings).toHaveLength(1);
		expect(findings[0]!.severity).toBe("CRITICAL");
		expect(findings[0]!.rule).toBe("index-not-concurrent");
	});
});
