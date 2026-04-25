// Re-export from lib layer so features import from their own domain

export type { AuthSession } from "#/lib/auth/server-fns";
export { getCurrentUser } from "#/lib/auth/server-fns";
