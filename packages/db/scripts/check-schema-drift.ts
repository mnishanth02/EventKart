import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

// drizzle-kit generate only reads the schema files — it doesn't connect to the DB.
// Set a dummy DATABASE_URL so drizzle.config.ts doesn't throw.
const env = {
	...process.env,
	DATABASE_URL:
		process.env.DATABASE_URL ?? "postgres://drift-check@localhost/dummy",
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "drizzle-drift-"));
const tempConfigPath = path.join(
	pkgRoot,
	`.drizzle-drift-${process.pid}.config.ts`,
);
const existingMetaDir = path.join(pkgRoot, "drizzle", "meta");
const tempMetaDir = path.join(tmpDir, "meta");

try {
	console.log("🔍 Checking for schema drift…");

	fs.cpSync(existingMetaDir, tempMetaDir, { recursive: true });

	fs.writeFileSync(
		tempConfigPath,
		[
			'import { defineConfig } from "drizzle-kit";',
			"",
			"export default defineConfig({",
			'\tdialect: "postgresql",',
			'\tschema: "./src/schema/index.ts",',
			`\tout: ${JSON.stringify(tmpDir)},`,
			"\tdbCredentials: {",
			'\t\turl: process.env.DATABASE_URL ?? "postgres://drift-check@localhost/dummy",',
			"\t},",
			"});",
			"",
		].join("\n"),
	);

	execSync(`pnpm exec drizzle-kit generate --config "${tempConfigPath}"`, {
		cwd: pkgRoot,
		env,
		stdio: "pipe",
	});

	// drizzle-kit writes a `meta` folder + SQL files. If any .sql file was generated,
	// there are schema changes that haven't been captured in a migration.
	const generated = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".sql"));

	if (generated.length > 0) {
		console.error(
			"❌ Schema drift detected: schema changes without migration files.",
		);
		console.error("   Generated files:", generated.join(", "));
		process.exitCode = 1;
	} else {
		console.log("✅ No schema drift — all changes have migration files.");
	}
} catch (error) {
	// drizzle-kit generate exits 0 even when "nothing to generate", but may print
	// "No schema changes, nothing to migrate" to stderr and still exit 0.
	// A non-zero exit code means something unexpected happened.
	const message = error instanceof Error ? error.message : String(error);

	// "nothing to migrate" is the happy path
	if (
		message.includes("nothing to migrate") ||
		message.includes("No schema changes")
	) {
		console.log("✅ No schema drift — all changes have migration files.");
	} else {
		console.error("❌ Schema drift check failed:", message);
		process.exitCode = 1;
	}
} finally {
	fs.rmSync(tempConfigPath, { force: true });
	fs.rmSync(tmpDir, { recursive: true, force: true });
}
