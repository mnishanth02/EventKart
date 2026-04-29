import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";

export interface PublicEventPolicyTextProps {
	refundPolicy: string | null;
	cancellationPolicy: string | null;
}

export function PublicEventPolicyText({
	refundPolicy,
	cancellationPolicy,
}: PublicEventPolicyTextProps) {
	if (!refundPolicy && !cancellationPolicy) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Policies</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5 text-sm leading-6 text-muted-foreground">
				{refundPolicy ? (
					<section className="space-y-2">
						<h2 className="font-display text-lg font-semibold text-foreground">
							Refund policy
						</h2>
						<p className="whitespace-pre-line">{refundPolicy}</p>
					</section>
				) : null}
				{cancellationPolicy ? (
					<section className="space-y-2">
						<h2 className="font-display text-lg font-semibold text-foreground">
							Cancellation policy
						</h2>
						<p className="whitespace-pre-line">{cancellationPolicy}</p>
					</section>
				) : null}
			</CardContent>
		</Card>
	);
}
