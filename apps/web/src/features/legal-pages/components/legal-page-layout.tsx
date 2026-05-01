import type { ReactNode } from "react";

export interface LegalPageLayoutProps {
	/** Page title rendered as the H1. */
	title: string;
	/**
	 * Document version (e.g. `"1.0.0"`). When supplied alongside
	 * {@link LegalPageLayoutProps.effectiveDate}, a small muted line is
	 * rendered directly under the H1: "Version {version} · Last updated
	 * {effectiveDate}". Both fields must be present; a single field on
	 * its own renders no metadata line.
	 */
	version?: string;
	/** Effective date of the current document version. See `version`. */
	effectiveDate?: string;
	/** Page body — typically the legal/static copy. */
	children: ReactNode;
}

/**
 * Shared layout for the Module 2.5 static legal/public routes
 * (`/privacy`, `/terms`, `/about`, `/faq`, `/contact`).
 *
 * Renders an `<article>` centered in a `max-w-3xl` container that mirrors
 * the spacing rhythm used by `PublicOrganizerProfile` and other public
 * pages. The body is wrapped in a Tailwind Typography (`prose`) container
 * so legal copy authored as plain JSX (`<h2>`, `<p>`, `<ul>`, links)
 * inherits readable defaults without per-page styling.
 *
 * Typography decision: `@tailwindcss/typography` IS installed in
 * `apps/web/package.json` and registered as a `@plugin` in
 * `apps/web/src/styles.css`, so the `prose` utility classes are
 * available at runtime. We use them here. If the plugin is ever
 * removed, swap the wrapper className for the utility-class fallback
 * (spacing-only, `space-y-6 [&_h2]:font-display [&_h2]:text-2xl …`)
 * documented in this folder's README.
 */
export function LegalPageLayout({
	title,
	version,
	effectiveDate,
	children,
}: LegalPageLayoutProps) {
	const showMeta =
		typeof version === "string" && typeof effectiveDate === "string";

	return (
		<article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="font-display font-bold text-3xl tracking-tight md:text-4xl">
				{title}
			</h1>
			{showMeta ? (
				<p className="mt-2 text-muted-foreground text-sm">
					Version {version} · Last updated {effectiveDate}
				</p>
			) : null}
			<div className="prose prose-neutral mt-8 max-w-none dark:prose-invert">
				{children}
			</div>
		</article>
	);
}
