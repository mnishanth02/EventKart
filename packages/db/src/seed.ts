import { createDatabase } from "./client.js";
import { users } from "./schema/index.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error("DATABASE_URL is required for seeding");
	process.exit(1);
}

const db = createDatabase(DATABASE_URL);

async function seed() {
	console.log("🌱 Seeding database...");

	// Seed dev users for each role
	await db
		.insert(users)
		.values([
			{
				phone: "+919999900001",
				email: "admin@eventkart.dev",
				name: "Dev Admin",
				role: "admin",
			},
			{
				phone: "+919999900002",
				email: "organizer@eventkart.dev",
				name: "Dev Organizer",
				role: "organizer",
			},
			{
				phone: "+919999900003",
				email: "participant@eventkart.dev",
				name: "Dev Participant",
				role: "participant",
			},
		])
		.onConflictDoNothing();

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
