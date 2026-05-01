import { Link } from "@tanstack/react-router";
import { SUPPORT_EMAIL } from "#/features/legal-pages/constants";

function PublicFooter() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="mt-auto border-t border-border bg-background/60 pb-16 md:pb-0">
			<div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 lg:px-8">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4">
					<div className="col-span-2 flex flex-col gap-1 md:col-span-1">
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

					<nav aria-label="Footer Discover">
						<h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
							Discover
						</h2>
						<ul className="mt-3 space-y-2 text-sm text-muted-foreground">
							<li>
								<Link to="/" className="hover:text-foreground">
									Discover events
								</Link>
							</li>
						</ul>
					</nav>

					<nav aria-label="Footer Company">
						<h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
							Company
						</h2>
						<ul className="mt-3 space-y-2 text-sm text-muted-foreground">
							<li>
								<Link to="/about" className="hover:text-foreground">
									About
								</Link>
							</li>
							<li>
								<Link to="/faq" className="hover:text-foreground">
									FAQ
								</Link>
							</li>
							<li>
								<Link to="/contact" className="hover:text-foreground">
									Contact
								</Link>
							</li>
						</ul>
					</nav>

					<nav aria-label="Footer Legal">
						<h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
							Legal
						</h2>
						<ul className="mt-3 space-y-2 text-sm text-muted-foreground">
							<li>
								<Link to="/privacy" className="hover:text-foreground">
									Privacy
								</Link>
							</li>
							<li>
								<Link to="/terms" className="hover:text-foreground">
									Terms
								</Link>
							</li>
						</ul>
					</nav>
				</div>

				<div className="mt-8 flex flex-col items-center gap-2 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:justify-between">
					<p>&copy; {currentYear} EventKart. All rights reserved.</p>
					<a
						href={`mailto:${SUPPORT_EMAIL}`}
						className="hover:text-foreground"
					>
						{SUPPORT_EMAIL}
					</a>
				</div>
			</div>
		</footer>
	);
}

export { PublicFooter };
