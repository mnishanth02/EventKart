import { createFileRoute } from "@tanstack/react-router";
import { checkApiReachability } from "#/lib/health";

export const Route = createFileRoute("/ready")({
	server: {
		handlers: {
			GET: async () => {
				const checks = [await checkApiReachability()];
				const allOk = checks.every((c) => c.status === "ok");

				return Response.json(
					{
						status: allOk ? "ok" : "degraded",
						uptime: process.uptime(),
						checks,
					},
					{ status: allOk ? 200 : 503 },
				);
			},
		},
	},
});
