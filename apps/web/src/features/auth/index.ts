// Types
export type { AuthSession, AuthState } from "./types";

// Server function re-exports
export { getCurrentUser } from "./api";

// Query options
export { AUTH_QUERY_KEY, sessionQueryOptions } from "./queries";

// Hooks
export { useAuth, useAuthActions, useRequireAuth } from "./hooks";

// Components
export {
	OtpLoginDialog,
	type OtpLoginDialogProps,
	PhoneInput,
	type PhoneInputProps,
	OtpInput,
	type OtpInputProps,
} from "./components";
