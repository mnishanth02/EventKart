/**
 * Recipe: Sonner Toast Patterns
 *
 * Three production toast flows, each tuned for the EventKart v2 motion +
 * a11y spec:
 *
 *   1. `toast.success` with an Undo action (8s window) — used after archiving
 *      an event or removing an attendee.
 *   2. `toast.promise` — wraps the async create-event request and shows
 *      loading / success / error states from a single call site.
 *   3. `toast.error` with a Retry action — invoked when a network call fails;
 *      the action re-runs the same mutation.
 *
 * a11y:
 *  - Sonner's `<Toaster>` mounts an `aria-live="polite"` region by default;
 *    `richColors` gives status icons distinct semantic color.
 *  - Reduced motion: Sonner auto-disables slide-in animation when the OS
 *    prefers-reduced-motion media query is set.
 *
 * Common mistakes:
 *  - ❌ Calling `toast.success` inside a `useEffect` that runs on every
 *    render → spams the user. Trigger only from event handlers / mutation
 *    callbacks.
 *  - ❌ Using `duration: Infinity` for non-critical toasts — accessibility
 *    issue for screen readers.
 */

import { Button } from "@repo/ui/components/ui/button";
import { Toaster, toast } from "@repo/ui/components/ui/sonner";

async function archiveEvent(eventId: string) {
	await new Promise((r) => setTimeout(r, 250));
	return { restore: () => Promise.resolve({ eventId }) };
}

async function createEvent(payload: { title: string }) {
	await new Promise((r) => setTimeout(r, 800));
	if (!payload.title) throw new Error("Title required");
	return { id: "evt_98213", ...payload };
}

async function checkInAttendee(attendeeId: string) {
	await new Promise((r) => setTimeout(r, 150));
	if (Math.random() < 0.5) throw new Error("Network error");
	return attendeeId;
}

export function ToastShowcase() {
	async function onArchive() {
		const { restore } = await archiveEvent("evt_123");
		toast.success("Event archived", {
			description: "Sunburn Goa 2025 moved to archives.",
			duration: 8000,
			action: {
				label: "Undo",
				onClick: () => {
					void restore();
					toast.message("Restored");
				},
			},
		});
	}

	function onCreate() {
		toast.promise(createEvent({ title: "NH7 Weekender" }), {
			loading: "Creating event…",
			success: (e) => `Event "${e.title}" created (${e.id})`,
			error: (err: Error) => `Could not create event: ${err.message}`,
		});
	}

	async function tryCheckIn(attendeeId: string) {
		try {
			await checkInAttendee(attendeeId);
			toast.success(`Checked in ${attendeeId}`);
		} catch (e) {
			toast.error("Check-in failed", {
				description: (e as Error).message,
				action: { label: "Retry", onClick: () => void tryCheckIn(attendeeId) },
			});
		}
	}

	return (
		<>
			{/* Mount once per app, near root. Position per v1 spec: bottom-right on
			    desktop, top-center on small viewports (Sonner handles via CSS). */}
			<Toaster position="bottom-right" richColors closeButton />

			<div className="flex gap-3 p-6">
				<Button onClick={onArchive}>Archive event</Button>
				<Button onClick={onCreate}>Create event</Button>
				<Button variant="outline" onClick={() => tryCheckIn("att_001")}>
					Check in attendee
				</Button>
			</div>
		</>
	);
}
