import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { VerifiedBadge } from "@repo/ui/components/verified-badge";
import type { OrganizerPublicProfile } from "../types";

export interface PublicOrganizerProfileProps {
	profile: OrganizerPublicProfile;
}

/**
 * Server-renderable public organizer profile (I-2.3.1).
 *
 * Displays the organizer's business name with an inline verified badge
 * (when applicable), the city they operate from, and the self-authored
 * "about" description. When the organizer has not provided a
 * description, a subtle placeholder is rendered so the section never
 * collapses to an empty card.
 *
 * Rendered as plain text via `whitespace-pre-line` (NO
 * `dangerouslySetInnerHTML`): the description is stored unsanitized
 * `text` in the DB and the API only normalizes empties to `null`, so
 * any HTML must remain inert in the public surface.
 *
 * Out of scope for I-2.3.1 (tracked as I-2.3.2/2.3.3/2.3.6): organizer
 * event listings, "next event" widget, past-events section. This
 * component is intentionally narrow so verified-organizer affordances
 * from `/events/:slug` have a real landing page without bringing in
 * the rest of the organizer experience.
 */
export function PublicOrganizerProfile({
	profile,
}: PublicOrganizerProfileProps) {
	return (
		<div className="bg-background">
			<div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
				<Card>
					<CardHeader className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle className="font-semibold text-2xl text-foreground sm:text-3xl">
								{profile.businessName}
							</CardTitle>
							{profile.isVerified === true ? (
								<VerifiedBadge variant="inline" />
							) : null}
						</div>
						<p className="text-muted-foreground text-sm">
							Based in {profile.city}
						</p>
					</CardHeader>
					<Separator />
					<CardContent className="space-y-3 pt-6 text-sm">
						<h2 className="font-semibold text-base text-foreground">About</h2>
						{profile.description !== null ? (
							<p className="whitespace-pre-line text-muted-foreground leading-6">
								{profile.description}
							</p>
						) : (
							<p className="text-muted-foreground italic leading-6">
								This organizer hasn&rsquo;t added a description yet.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
