import { VERIFICATION_SLA_BUSINESS_DAYS } from "@repo/shared/constants";
import { Badge } from "@repo/ui/components/ui/badge";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addBusinessDays(date: Date, businessDays: number): Date {
	const dueDate = new Date(date);
	let remainingDays = businessDays;

	while (remainingDays > 0) {
		dueDate.setDate(dueDate.getDate() + 1);
		const day = dueDate.getDay();
		if (day !== 0 && day !== 6) {
			remainingDays -= 1;
		}
	}

	return dueDate;
}

function isValidDate(date: Date): boolean {
	return !Number.isNaN(date.getTime());
}

export function formatSlaDate(date: Date): string {
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export function getVerificationSlaInfo(
	submittedForReviewAt: string | null,
	reviewedAt?: string | null,
) {
	if (!submittedForReviewAt) return null;

	const submittedAt = new Date(submittedForReviewAt);
	if (!isValidDate(submittedAt)) return null;

	const dueAt = addBusinessDays(submittedAt, VERIFICATION_SLA_BUSINESS_DAYS);
	const referenceDate = reviewedAt ? new Date(reviewedAt) : new Date();
	const isOverdue = isValidDate(referenceDate) && referenceDate > dueAt;
	const daysUntilDue = Math.ceil((dueAt.getTime() - Date.now()) / MS_PER_DAY);

	return {
		dueAt,
		isOverdue,
		daysUntilDue,
	};
}

export function VerificationSlaBadge({
	status,
	submittedForReviewAt,
	reviewedAt,
}: {
	status: string;
	submittedForReviewAt: string | null;
	reviewedAt?: string | null;
}) {
	const sla = getVerificationSlaInfo(submittedForReviewAt, reviewedAt);
	if (!sla) {
		return <span className="text-muted-foreground">Not submitted</span>;
	}

	if (status !== "pending_review") {
		if (!reviewedAt) {
			return <span className="text-muted-foreground">—</span>;
		}

		return (
			<div className="flex flex-col gap-1">
				<Badge variant={sla.isOverdue ? "destructive" : "outline"}>
					{sla.isOverdue ? "Reviewed after SLA" : "Reviewed within SLA"}
				</Badge>
				<span className="text-xs text-muted-foreground">
					Due {formatSlaDate(sla.dueAt)}
				</span>
			</div>
		);
	}

	const label = sla.isOverdue
		? "SLA overdue"
		: sla.daysUntilDue <= 0
			? "Due today"
			: `Due in ${sla.daysUntilDue}d`;

	return (
		<div className="flex flex-col gap-1">
			<Badge variant={sla.isOverdue ? "destructive" : "outline"}>{label}</Badge>
			<span className="text-xs text-muted-foreground">
				Due {formatSlaDate(sla.dueAt)}
			</span>
		</div>
	);
}
