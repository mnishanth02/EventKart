/**
 * Toast helpers — opinionated wrappers around sonner that encode
 * EventKart's notification patterns in one place.
 *
 *   toastUndo    — success toast with an Undo action and 8 s window
 *                  (used after destructive-but-reversible actions like
 *                   archiving an event or removing an attendee).
 *   toastRetry   — error toast with a Retry action that re-runs the
 *                  caller-supplied operation.
 *   toastPromise — thin re-export of sonner's promise() pattern.
 *
 * Sonner's <Toaster> is mounted once in `apps/web/src/routes/__root.tsx`.
 * Do NOT mount additional Toasters; sonner enqueues by single instance.
 *
 * a11y notes:
 *   - sonner's Toaster auto-mounts an aria-live="polite" region.
 *   - Reduced motion is handled by sonner via prefers-reduced-motion.
 *   - Avoid `duration: Infinity` — screen readers read indefinitely.
 *
 * Common mistakes:
 *   - ❌ Calling these inside useEffect with no deps → spams the user on
 *     every render. Trigger only from event handlers or mutation callbacks.
 */

import { toast } from "sonner";

export interface ToastUndoOptions {
	description?: string;
	/** Window in milliseconds to show the Undo action. Default 8 000 ms. */
	duration?: number;
	/** Label on the action button. Default "Undo". */
	actionLabel?: string;
	/** Called when the user clicks Undo. May be sync or async. */
	onUndo: () => void | Promise<void>;
	/** Optional message after a successful undo. Default "Restored". */
	undoMessage?: string;
}

/**
 * Success toast with an Undo action. Returns the toast id so callers can
 * dismiss it programmatically (e.g. after a follow-up mutation supersedes it).
 */
export function toastUndo(
	message: string,
	options: ToastUndoOptions,
): string | number {
	const {
		description,
		duration = 8000,
		actionLabel = "Undo",
		onUndo,
		undoMessage = "Restored",
	} = options;

	return toast.success(message, {
		...(description !== undefined && { description }),
		duration,
		action: {
			label: actionLabel,
			onClick: () => {
				try {
					const result = onUndo();
					if (result instanceof Promise) {
						result.then(
							() => toast.message(undoMessage),
							(err: unknown) => {
								const detail = err instanceof Error ? err.message : String(err);
								toast.error("Undo failed", { description: detail });
							},
						);
					} else {
						toast.message(undoMessage);
					}
				} catch (err) {
					const detail = err instanceof Error ? err.message : String(err);
					toast.error("Undo failed", { description: detail });
				}
			},
		},
	});
}

export interface ToastRetryOptions {
	description?: string;
	/** Label on the action button. Default "Retry". */
	actionLabel?: string;
	/** Re-runs the failed operation when the user clicks Retry. */
	onRetry: () => void | Promise<void>;
}

/**
 * Error toast with a Retry action. The action handler is wrapped so an
 * async retry that throws does NOT propagate as an unhandled rejection.
 */
export function toastRetry(
	message: string,
	options: ToastRetryOptions,
): string | number {
	const { description, actionLabel = "Retry", onRetry } = options;

	return toast.error(message, {
		...(description !== undefined && { description }),
		action: {
			label: actionLabel,
			onClick: () => {
				try {
					const result = onRetry();
					if (result instanceof Promise) {
						result.catch((err: unknown) => {
							const detail = err instanceof Error ? err.message : String(err);
							toast.error("Retry failed", { description: detail });
						});
					}
				} catch (err) {
					const detail = err instanceof Error ? err.message : String(err);
					toast.error("Retry failed", { description: detail });
				}
			},
		},
	});
}

/**
 * Re-export of `toast.promise` so callers can `import { toastPromise }`
 * from the design-system entry point instead of reaching into sonner.
 */
export const toastPromise = toast.promise.bind(toast);
