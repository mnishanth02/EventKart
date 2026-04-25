// Types

// Server function re-exports
export { getCurrentUser } from "./api";
// Components
export {
	OtpInput,
	type OtpInputProps,
	OtpLoginDialog,
	type OtpLoginDialogProps,
	PhoneInput,
	type PhoneInputProps,
} from "./components";
// Hooks
export { useAuth, useAuthActions, useRequireAuth } from "./hooks";
// Query options
export { AUTH_QUERY_KEY, sessionQueryOptions } from "./queries";
export type { AuthSession, AuthState } from "./types";
