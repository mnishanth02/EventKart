import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";

export function PublicEventRegisterCta() {
	return (
		<Card id="register-coming-soon" className="scroll-mt-24 border-primary/30">
			<CardHeader>
				<CardTitle>Ready to race?</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Booking opens with our launch — check back soon.
				</p>
				<Button asChild size="lg" className="w-full">
					<a href="#register-coming-soon">Registration coming soon</a>
				</Button>
			</CardContent>
			<CardFooter>
				<a
					href="#policies"
					className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
				>
					Review refund &amp; cancellation policies
				</a>
			</CardFooter>
		</Card>
	);
}
