import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createMigrationClient } from "../src/client.js";

const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
	console.error(
		"❌ DATABASE_URL or MIGRATION_DATABASE_URL must be set to run migrations.",
	);
	process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../drizzle");

console.log("🔄 Running database migrations…");

const db = createMigrationClient(url);

try {
	await migrate(db, { migrationsFolder });
	console.log("✅ Migrations applied successfully.");
} catch (error) {
	console.error("❌ Migration failed:", error);
	process.exit(1);
} finally {
	// drizzle-orm wraps a postgres.js client — access it to close the connection
	await (db.$client as { end: () => Promise<void> }).end();
}
