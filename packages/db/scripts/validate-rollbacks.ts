import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../drizzle");
const rollbacksDir = path.join(migrationsDir, "rollbacks");

const migrationFiles = fs
	.readdirSync(migrationsDir)
	.filter((f) => f.endsWith(".sql"))
	.sort();

// The first migration (0000_*) bootstraps the DB — it is exempt from rollbacks.
const requiresRollback = migrationFiles.filter((f) => !f.startsWith("0000_"));

if (requiresRollback.length === 0) {
	console.log("✅ No non-initial migrations found — nothing to validate.");
	process.exit(0);
}

const errors: string[] = [];

for (const migration of requiresRollback) {
	const rollbackName = migration.replace(/\.sql$/, ".rollback.sql");
	const rollbackPath = path.join(rollbacksDir, rollbackName);

	if (!fs.existsSync(rollbackPath)) {
		errors.push(`Missing rollback: rollbacks/${rollbackName}`);
		continue;
	}

	const content = fs.readFileSync(rollbackPath, "utf-8").trim();
	if (content.length === 0) {
		errors.push(`Empty rollback: rollbacks/${rollbackName}`);
	}
}

if (errors.length > 0) {
	console.error("❌ Rollback validation failed:");
	for (const err of errors) {
		console.error(`   • ${err}`);
	}
	process.exit(1);
}

console.log(
	`✅ All ${requiresRollback.length} rollback(s) present and non-empty.`,
);
