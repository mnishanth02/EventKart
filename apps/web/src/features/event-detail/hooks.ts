import { useEffect, useState } from "react";

/**
 * SSR-safe "current time" hook.
 *
 * Returns `null` during SSR and on the first client render so initial markup
 * matches between server and hydration. After mount, returns a real `Date`.
 *
 * Components that depend on `now` should render nothing (or a stable
 * non-volatile fallback) when the value is `null`. This keeps CDN-cached HTML
 * truthful: it never advertises an "Active" badge or "From ₹X" price that
 * could be stale by the time the client receives it.
 *
 * No interval is used — the page is not a live countdown (that is I-2.1.10).
 */
export function useNow(): Date | null {
	const [now, setNow] = useState<Date | null>(null);

	useEffect(() => {
		setNow(new Date());
	}, []);

	return now;
}
