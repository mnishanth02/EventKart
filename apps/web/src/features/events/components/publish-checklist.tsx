import type { PublishReadiness } from "@repo/shared/schemas";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/ui/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";

export function PublishChecklist({
	readiness,
}: {
	readiness: PublishReadiness;
}) {
	const missingCount = readiness.items.filter((item) => !item.passed).length;

	return (
		<Card aria-live="polite">
			<CardHeader>
				<CardTitle>Publish readiness</CardTitle>
				<CardDescription>
					{readiness.ready
						? "This event is ready to publish."
						: `${missingCount} item${missingCount === 1 ? "" : "s"} need attention before publishing.`}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{readiness.wouldRequireAdminReview ? (
					<Alert>
						<AlertTitle>Admin review required</AlertTitle>
						<AlertDescription>
							This event will be submitted for admin review before it goes live.
						</AlertDescription>
					</Alert>
				) : null}
				<ul className="space-y-2" aria-label="Publish readiness checklist">
					{readiness.items.map((item) => (
						<li
							key={item.check}
							className="flex items-start gap-2 rounded-md border p-3"
						>
							<span aria-hidden="true">{item.passed ? "✅" : "⚠️"}</span>
							<span>
								<span className="block font-medium">
									{item.passed ? "Complete" : "Required"}
								</span>
								<span className="text-muted-foreground text-sm">
									{item.message}
								</span>
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
