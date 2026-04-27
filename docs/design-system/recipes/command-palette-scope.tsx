/**
 * Recipe: Scoped Command Palette (Cmd/Ctrl+K)
 *
 * A single `<CommandDialog>` whose contents change based on the current
 * TanStack Router route prefix. Recents are persisted in localStorage under
 * `eventkart.cmdk.recent.v1`. Cmd+K (Ctrl+K on Win/Linux) toggles the dialog.
 *
 * Common mistakes:
 *  - ❌ Forgetting to remove the keydown listener on unmount → duplicate fires
 *    after HMR / route changes.
 *  - ❌ Reading localStorage during render — breaks SSR. We hydrate inside
 *    `useEffect`.
 *  - ❌ Trapping the shortcut while the user is typing in an <input>.
 */

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@repo/ui/components/ui/command";
import { useRouter, useNavigate } from "@tanstack/react-router";
import {
	BarChart3,
	CalendarPlus,
	History,
	Search,
	Ticket,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";

const RECENTS_KEY = "eventkart.cmdk.recent.v1";

type Recent = { id: string; label: string; href: string };

function loadRecents(): Recent[] {
	if (typeof window === "undefined") return [];
	try {
		return JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? "[]");
	} catch {
		return [];
	}
}

function pushRecent(item: Recent) {
	const next = [item, ...loadRecents().filter((r) => r.id !== item.id)].slice(
		0,
		6,
	);
	window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

export function CommandPaletteScope() {
	const [open, setOpen] = useState(false);
	const [recents, setRecents] = useState<Recent[]>([]);
	const router = useRouter();
	const navigate = useNavigate();
	const pathname = router.state.location.pathname;

	useEffect(() => {
		setRecents(loadRecents());
	}, [open]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			const isMeta = e.metaKey || e.ctrlKey;
			if (isMeta && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((v) => !v);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	function go(item: Recent) {
		pushRecent(item);
		setOpen(false);
		navigate({ to: item.href });
	}

	const inOrganizer = pathname.startsWith("/organizer");
	const inAttendee = pathname.startsWith("/me");

	return (
		<CommandDialog open={open} onOpenChange={setOpen}>
			<CommandInput placeholder="Search events, attendees, bookings…" />
			<CommandList>
				<CommandEmpty>No matches.</CommandEmpty>

				{recents.length > 0 && (
					<CommandGroup heading="Recent">
						{recents.map((r) => (
							<CommandItem key={r.id} onSelect={() => go(r)}>
								<History className="mr-2 size-4" />
								{r.label}
							</CommandItem>
						))}
					</CommandGroup>
				)}

				<CommandSeparator />

				{inOrganizer && (
					<CommandGroup heading="Organizer">
						<CommandItem
							onSelect={() =>
								go({
									id: "new-event",
									label: "Create new event",
									href: "/organizer/events/new",
								})
							}
						>
							<CalendarPlus className="mr-2 size-4" /> Create new event
						</CommandItem>
						<CommandItem
							onSelect={() =>
								go({
									id: "attendees",
									label: "Manage attendees",
									href: "/organizer/attendees",
								})
							}
						>
							<Users className="mr-2 size-4" /> Manage attendees
						</CommandItem>
						<CommandItem
							onSelect={() =>
								go({
									id: "revenue",
									label: "Revenue report",
									href: "/organizer/reports/revenue",
								})
							}
						>
							<BarChart3 className="mr-2 size-4" /> Revenue report
						</CommandItem>
					</CommandGroup>
				)}

				{inAttendee && (
					<CommandGroup heading="My tickets">
						<CommandItem
							onSelect={() =>
								go({
									id: "my-bookings",
									label: "My bookings",
									href: "/me/bookings",
								})
							}
						>
							<Ticket className="mr-2 size-4" /> My bookings
						</CommandItem>
					</CommandGroup>
				)}

				<CommandGroup heading="Global">
					<CommandItem
						onSelect={() =>
							go({ id: "browse", label: "Browse events", href: "/events" })
						}
					>
						<Search className="mr-2 size-4" /> Browse events
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
