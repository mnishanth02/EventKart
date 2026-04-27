/**
 * Recipe: View Transition — Event Card → Detail Hero Morph
 *
 * Uses React 19's `useViewTransition` together with TanStack Router's
 * `<Link viewTransition>` to morph the cover image of an `<EventCard/>` into
 * the hero on the detail page. The `viewTransitionName` is reserved as
 * `event-card-{id}` per the EventKart design tokens spec.
 *
 * Common mistakes:
 *  - ❌ Using the same `viewTransitionName` for many cards on one page —
 *    browsers require uniqueness PER snapshot. We scope by event id.
 *  - ❌ Forgetting the reduced-motion fallback. We disable VT entirely when
 *    `prefers-reduced-motion: reduce` is set.
 *  - ❌ Putting the name on a wrapper div instead of the actual morphing
 *    element (image) — leads to "ghost" jumps.
 */

import { Link } from "@tanstack/react-router";
import { unstable_ViewTransition as ViewTransition } from "react";
import { useEffect, useState } from "react";

type Event = {
	id: string;
	title: string;
	cover: string;
	city: string;
	startsAt: string;
};

function usePrefersReducedMotion() {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mql.matches);
		const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);
	return reduced;
}

export function EventCard({ event }: { event: Event }) {
	const reduced = usePrefersReducedMotion();
	const vtName = reduced ? undefined : `event-card-${event.id}`;

	return (
		<Link
			to="/events/$id"
			params={{ id: event.id }}
			viewTransition={!reduced}
			className="group block overflow-hidden rounded-2xl bg-card"
		>
			<ViewTransition name={vtName}>
				<img
					src={event.cover}
					alt=""
					className="aspect-[16/9] w-full object-cover transition-transform group-hover:scale-[1.02]"
					style={{ viewTransitionName: vtName }}
				/>
			</ViewTransition>
			<div className="p-4">
				<h3 className="text-base font-semibold">{event.title}</h3>
				<p className="text-sm text-muted-foreground">
					{event.city} · {new Date(event.startsAt).toLocaleDateString("en-IN")}
				</p>
			</div>
		</Link>
	);
}

export function EventDetailHero({ event }: { event: Event }) {
	const reduced = usePrefersReducedMotion();
	const vtName = reduced ? undefined : `event-card-${event.id}`;

	return (
		<header className="relative">
			<ViewTransition name={vtName}>
				<img
					src={event.cover}
					alt=""
					className="aspect-[21/9] w-full object-cover"
					style={{ viewTransitionName: vtName }}
				/>
			</ViewTransition>
			<div
				className="absolute inset-x-0 bottom-0 p-6 text-white"
				style={{ viewTransitionName: "event-hero" }}
			>
				<h1 className="text-3xl font-bold">{event.title}</h1>
				<p className="opacity-90">
					{event.city} · {new Date(event.startsAt).toLocaleString("en-IN")}
				</p>
			</div>
		</header>
	);
}

export function EventCardGrid({ events }: { events: Event[] }) {
	return (
		<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{events.map((e) => (
				<li key={e.id}>
					<EventCard event={e} />
				</li>
			))}
		</ul>
	);
}
