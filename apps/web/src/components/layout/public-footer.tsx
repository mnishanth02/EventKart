import { Link } from "@tanstack/react-router";

function PublicFooter() {
	return (
		<footer className="mt-auto border-t border-border bg-background/60 pb-16 md:pb-0">
			<div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 lg:px-8">
				<div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
					<div className="flex flex-col items-center gap-1 md:items-start">
						<Link
							to="/"
							className="font-display text-lg font-bold tracking-tight text-foreground no-underline"
						>
							eventKart
						</Link>
						<p className="text-xs text-muted-foreground">
							The organizer operating system for fitness events in India.
						</p>
					</div>

					<nav
						className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
						aria-label="Footer"
					>
						<Link to="/" className="hover:text-foreground">
							Discover Events
						</Link>
						<a
							href="mailto:support@eventkart.run"
							className="hover:text-foreground"
						>
							Support
						</a>
					</nav>
				</div>

				<div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
					<p>
						&copy; {new Date().getFullYear()} EventKart. All rights reserved.
					</p>
				</div>
			</div>
		</footer>
	);
}

export { PublicFooter };
