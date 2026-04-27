/**
 * Recipe: Glass Card Tiers (1, 2, 3)
 *
 * EventKart defines three glass tiers as design tokens. This file is the
 * canonical reference for when to reach for each one.
 *
 *   Tier 1 — Navigation surfaces (sticky header, sidebar).
 *           Subtle blur, low opacity. Sits over arbitrary scrolling content.
 *
 *   Tier 2 — Hero overlays atop event cover photography.
 *           Heavier blur + scrim so text reaches AA contrast against media.
 *
 *   Tier 3 — Modal / sheet grade (booking confirmation popovers).
 *           Highest blur, near-solid background.
 *
 * A11y note: Tier 2 ALWAYS pairs with a scrim (`bg-black/40`) when over
 * imagery. Run a contrast check (>= 4.5:1) on text against the *worst-case*
 * pixel of the media — never against the glass alone.
 *
 * Common mistakes:
 *  - ❌ Using Tier 1 over photographic backgrounds — text fails contrast.
 *  - ❌ Inlining hex values instead of `var(--glass-*-bg)` tokens — themes
 *    won't follow.
 */

import { cn } from "@repo/ui/lib/utils";

type GlassProps = {
	tier: 1 | 2 | 3;
	className?: string;
	children?: React.ReactNode;
};

export function GlassSurface({ tier, className, children }: GlassProps) {
	const styles: React.CSSProperties = {
		background: `var(--glass-${tier}-bg)`,
		backdropFilter: `blur(var(--glass-${tier}-blur))`,
		WebkitBackdropFilter: `blur(var(--glass-${tier}-blur))`,
		borderColor: `var(--glass-${tier}-border)`,
	};
	return (
		<div
			data-glass-tier={tier}
			className={cn("rounded-2xl border", className)}
			style={styles}
		>
			{children}
		</div>
	);
}

/** Tier 1 — sticky organizer nav. */
export function NavGlass() {
	return (
		<GlassSurface tier={1} className="sticky top-0 z-40 flex items-center gap-4 px-4 py-3">
			<strong>EventKart</strong>
			<nav className="ml-auto flex gap-3 text-sm">
				<a href="/events">Events</a>
				<a href="/me/bookings">My bookings</a>
			</nav>
		</GlassSurface>
	);
}

/** Tier 2 — event hero overlay over a cover photo. Includes scrim. */
export function HeroOverlay({ event }: { event: { title: string; cover: string; city: string } }) {
	return (
		<section className="relative overflow-hidden rounded-2xl">
			<img src={event.cover} alt="" className="aspect-[21/9] w-full object-cover" />
			{/* Scrim for AA contrast against arbitrary media */}
			<div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
			<GlassSurface tier={2} className="absolute inset-x-4 bottom-4 p-5 text-white">
				<h2 className="text-xl font-semibold">{event.title}</h2>
				<p className="text-sm opacity-90">{event.city}</p>
			</GlassSurface>
		</section>
	);
}

/** Tier 3 — booking confirmation popover (modal-grade). */
export function BookingConfirmGlass({ bookingId }: { bookingId: string }) {
	return (
		<GlassSurface
			tier={3}
			className="mx-auto max-w-md p-6 shadow-xl"
			// Tier 3 is the strongest — typically used inside a Dialog/Sheet.
		>
			<h3 className="text-lg font-semibold">Booking confirmed</h3>
			<p className="mt-1 text-sm text-muted-foreground">
				Reference: <code className="font-mono">{bookingId}</code>
			</p>
			<p className="mt-3 text-sm">
				A confirmation email and your QR pass have been sent. Carry a valid ID
				to the venue.
			</p>
		</GlassSurface>
	);
}

export function GlassCardTiersDemo() {
	return (
		<div className="grid gap-6 p-6">
			<NavGlass />
			<HeroOverlay
				event={{
					title: "Sunburn Goa 2025",
					city: "Goa, IN",
					cover: "https://images.eventkart.in/sunburn-2025.jpg",
				}}
			/>
			<BookingConfirmGlass bookingId="EK-9F2A-7711" />
		</div>
	);
}
