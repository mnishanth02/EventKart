import type { AuthSession } from "#/lib/auth/server-fns";

export type { AuthSession };

export interface AuthState {
	session: AuthSession | null;
	isAuthenticated: boolean;
	isLoading: boolean;
}
