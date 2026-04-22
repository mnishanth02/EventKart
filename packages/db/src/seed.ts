import { createDatabase } from "./client.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error("DATABASE_URL is required for seeding");
	process.exit(1);
}

const _db = createDatabase(DATABASE_URL);

async function seed() {
	console.log("🌱 Seeding database...");

	// Use `_db` to insert seed data as tables are created (I-0.1.3+)

	console.log("✅ Seeding complete");
}

seed()
	.catch((error) => {
		console.error("❌ Seeding failed:", error);
		process.exit(1);
	})
	.finally(async () => {
		// postgres.js handles connection cleanup automatically
		process.exit(0);
	});
