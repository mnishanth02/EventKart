import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

/**
 * Create a Drizzle database client.
 *
 * Uses `prepare: false` to support PgBouncer transaction pooling mode.
 * For migrations, use `createMigrationClient` with a direct connection URL.
 */
export function createDatabase(url: string) {
	const client = postgres(url, {
		prepare: false,
	});

	return drizzle(client, { schema });
}

/** A single-connection client for running migrations (bypasses PgBouncer). */
export function createMigrationClient(url: string) {
	const client = postgres(url, { max: 1 });
	return drizzle(client);
}

export type Database = ReturnType<typeof createDatabase>;
