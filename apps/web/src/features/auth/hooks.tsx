import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OtpLoginDialog } from "./components";
import { AUTH_QUERY_KEY, sessionQueryOptions } from "./queries";
import type { AuthState } from "./types";

/**
 * Returns the current auth state derived from the session query.
 */
export function useAuth(): AuthState {
	const query = useQuery(sessionQueryOptions());

	return {
		session: query.data ?? null,
		isAuthenticated: query.data !== null && query.data !== undefined,
		isLoading: query.isLoading,
	};
}

/**
 * Returns auth action utilities for cache invalidation.
 * Separated from `useAuth` so components that only need to invalidate
 * (e.g. a logout button) don't subscribe to auth query changes.
 */
export function useAuthActions() {
	const queryClient = useQueryClient();

	function invalidateSession() {
		void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
	}

	function clearSession() {
		queryClient.setQueryData(AUTH_QUERY_KEY, null);
	}

	return { invalidateSession, clearSession };
}

/**
 * Returns a `requireAuth` function that checks auth state before executing
 * a callback. If the user is not authenticated, opens the OTP login dialog.
 * After successful login, executes the callback.
 *
 * If the session query is still loading, the callback is deferred until
 * the query resolves — the dialog is only shown if the user is truly
 * unauthenticated.
 *
 * The returned `loginDialog` element **must** be rendered by the consuming
 * component for the dialog to appear.
 *
 * @example
 * ```tsx
 * const { requireAuth, loginDialog } = useRequireAuth();
 *
 * function handleRegister() {
 *   requireAuth(() => {
 *     navigate({ to: "/book/$eventId", params: { eventId } });
 *   });
 * }
 *
 * return (
 *   <>
 *     <Button onClick={handleRegister}>Register Now</Button>
 *     {loginDialog}
 *   </>
 * );
 * ```
 */
export function useRequireAuth() {
	const { isAuthenticated, isLoading } = useAuth();
	const { invalidateSession } = useAuthActions();
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const pendingCallbackRef = useRef<(() => void) | null>(null);

	function requireAuth(callback: () => void) {
		if (isAuthenticated) {
			callback();
			return;
		}

		// If session query is still loading, wait for it before deciding
		if (isLoading) {
			void queryClient.ensureQueryData(sessionQueryOptions()).then((session) => {
				if (session) {
					callback();
				} else {
					pendingCallbackRef.current = callback;
					setDialogOpen(true);
				}
			});
			return;
		}

		pendingCallbackRef.current = callback;
		setDialogOpen(true);
	}

	function handleLoginSuccess() {
		invalidateSession();
		setDialogOpen(false);
		const callback = pendingCallbackRef.current;
		pendingCallbackRef.current = null;
		if (callback) {
			callback();
		}
	}

	const loginDialog = (
		<OtpLoginDialog
			open={dialogOpen}
			onOpenChange={setDialogOpen}
			onSuccess={handleLoginSuccess}
			title="Sign in to continue"
			description="Enter your phone number to verify your identity."
		/>
	);

	return { requireAuth, loginDialog };
}
