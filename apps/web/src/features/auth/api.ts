// Re-export from lib layer so features import from their own domain
export { getCurrentUser } from "#/lib/auth/server-fns";
export type { AuthSession } from "#/lib/auth/server-fns";
