import { createFileRoute } from "@tanstack/react-router";
import { VerificationReviewDetail } from "#/features/admin/components/verification-review-detail";

export const Route = createFileRoute(
	"/_authed/admin/verifications/$organizerId",
)({
	component: VerificationReviewPage,
	ssr: "data-only",
});

function VerificationReviewPage() {
	const { organizerId } = Route.useParams();
	return <VerificationReviewDetail organizerId={organizerId} />;
}
