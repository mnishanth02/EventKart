/**
 * SSR session forwarding — client-safe entry point.
 *
 * Server-only helpers (getForwardedAuthHeaders, etc.) live in
 * `./server-fns.server.ts` to keep `@tanstack/react-start/server`
 * out of the client bundle graph.
 */

import { createServerFn } from "@tanstack/react-start";
import type { UserRole } from "@repo/shared/constants/roles";

// ── Types ──────────────────────────────────────────────────────────

export type AuthSession = {
	userId: string;
	role: UserRole;
};

// ── Server Functions ───────────────────────────────────────────────

/**
 * Server function that returns the current authenticated user session,
 * or `null` when unauthenticated (401 from the API).
 */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
	async (): Promise<AuthSession | null> => {
		const { fetchCurrentUser } = await import("./server-fns.server");
		return fetchCurrentUser();
	},
);

