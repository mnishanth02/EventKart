import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Finding {
	file: string;
	line: number;
	severity: "CRITICAL" | "WARNING";
	rule: string;
	message: string;
	statement: string;
}

export interface Report {
	files_checked: number;
	findings: Finding[];
	critical_count: number;
	warning_count: number;
	passed: boolean;
}

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";
const INITIAL_MIGRATION_RE = /^0000_/;

interface Rule {
	id: string;
	severity: "CRITICAL" | "WARNING";
	message: string;
	test: (statement: string, filename: string) => boolean;
}

const rules: Rule[] = [
	{
		id: "not-null-without-default",
		severity: "CRITICAL",
		message:
			"ADD COLUMN with NOT NULL but no DEFAULT requires full table rewrite",
		test: (statement) => {
			return (
				/\bADD\s+COLUMN\b/i.test(statement) &&
				/\bNOT\s+NULL\b/i.test(statement) &&
				!/\bDEFAULT\b/i.test(statement)
			);
		},
	},
	{
		id: "index-not-concurrent",
		severity: "CRITICAL",
		message: "CREATE INDEX without CONCURRENTLY blocks writes",
		test: (statement, filename) => {
			if (INITIAL_MIGRATION_RE.test(filename)) return false;
			return /\bCREATE\s+(UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY\b)/i.test(
				statement,
			);
		},
	},
	{
		id: "alter-column-type",
		severity: "WARNING",
		message: "ALTER COLUMN TYPE causes table rewrite with exclusive lock",
		test: (statement) => {
			return /\bALTER\s+TABLE\b[\s\S]*\bALTER\s+COLUMN\b[\s\S]*\b(SET\s+DATA\s+)?TYPE\b/i.test(
				statement,
			);
		},
	},
	{
		id: "drop-column",
		severity: "WARNING",
		message: "DROP COLUMN requires brief exclusive lock",
		test: (statement) => {
			return /\bDROP\s+COLUMN\b/i.test(statement);
		},
	},
	{
		id: "drop-table",
		severity: "WARNING",
		message: "DROP TABLE causes irreversible data loss if not backed up",
		test: (statement) => {
			return /\bDROP\s+TABLE\b/i.test(statement);
		},
	},
	{
		id: "fk-without-not-valid",
		severity: "CRITICAL",
		message:
			"ADD FOREIGN KEY without NOT VALID validates all rows under exclusive lock",
		test: (statement) => {
			return (
				/\bADD\s+CONSTRAINT\b[\s\S]*\bFOREIGN\s+KEY\b/i.test(statement) &&
				!/\bNOT\s+VALID\b/i.test(statement)
			);
		},
	},
	{
		id: "lock-table",
		severity: "WARNING",
		message: "Explicit LOCK TABLE detected",
		test: (statement) => {
			return /\bLOCK\s+TABLE\b/i.test(statement);
		},
	},
];

function computeLineNumber(sql: string, offset: number, raw: string): number {
	const linesBefore = sql.substring(0, offset).split("\n").length;
	const firstNonWS = raw.search(/\S/);
	if (firstNonWS <= 0) return linesBefore;
	const leadingLines = raw.substring(0, firstNonWS).split("\n").length - 1;
	return linesBefore + leadingLines;
}

function truncateStatement(statement: string): string {
	const normalized = statement.replace(/\s+/g, " ");
	if (normalized.length <= 200) return normalized;
	return `${normalized.slice(0, 200)}...`;
}

export function analyzeMigrationSQL(
	sql: string,
	filename: string,
): Finding[] {
	// Initial migration (0000_*) bootstraps a fresh, empty DB — no rows to lock,
	// no concurrent access. All checks are exempt.
	if (INITIAL_MIGRATION_RE.test(filename)) return [];

	const findings: Finding[] = [];
	const parts = sql.split(STATEMENT_BREAKPOINT);
	let offset = 0;

	for (const raw of parts) {
		const statement = raw.trim();
		if (statement) {
			const line = computeLineNumber(sql, offset, raw);

			for (const rule of rules) {
				if (rule.test(statement, filename)) {
					findings.push({
						file: filename,
						line,
						severity: rule.severity,
						rule: rule.id,
						message: rule.message,
						statement: truncateStatement(statement),
					});
				}
			}
		}

		offset += raw.length + STATEMENT_BREAKPOINT.length;
	}

	return findings;
}

// --- CLI entrypoint ---

function main(): void {
	const scriptDir = dirname(fileURLToPath(import.meta.url));
	const drizzleDir = join(scriptDir, "..", "drizzle");

	const files = readdirSync(drizzleDir)
		.filter((f) => f.endsWith(".sql"))
		.sort();

	const allFindings: Finding[] = [];

	for (const file of files) {
		const sql = readFileSync(join(drizzleDir, file), "utf-8");
		allFindings.push(...analyzeMigrationSQL(sql, file));
	}

	const criticalCount = allFindings.filter(
		(f) => f.severity === "CRITICAL",
	).length;
	const warningCount = allFindings.filter(
		(f) => f.severity === "WARNING",
	).length;

	const report: Report = {
		files_checked: files.length,
		findings: allFindings,
		critical_count: criticalCount,
		warning_count: warningCount,
		passed: criticalCount === 0,
	};

	console.log(JSON.stringify(report, null, 2));

	if (allFindings.length === 0) {
		console.error(
			`✅ ${files.length} migration(s) checked — no issues found`,
		);
	} else {
		console.error("\n🔍 Migration lock-risk report:");
		for (const f of allFindings) {
			const icon = f.severity === "CRITICAL" ? "🚨" : "⚠️";
			console.error(
				`  ${icon} [${f.severity}] ${f.file}:${f.line} — ${f.message}`,
			);
		}
		console.error(
			`\nSummary: ${criticalCount} critical, ${warningCount} warnings`,
		);
	}

	process.exit(report.passed ? 0 : 1);
}

const isDirectRun = (() => {
	try {
		const argPath = process.argv[1];
		if (!argPath) return false;
		return resolve(argPath) === fileURLToPath(import.meta.url);
	} catch {
		return false;
	}
})();

if (isDirectRun) {
	main();
}
