import type { FastifyBaseLogger } from "fastify";

export interface EmailPayload {
	to: string;
	subject: string;
	html: string;
}

export interface EmailDeps {
	resendApiKey?: string;
	emailFrom: string;
	log: FastifyBaseLogger;
}

export async function sendEmail(
	deps: EmailDeps,
	payload: EmailPayload,
): Promise<{ messageId: string }> {
	if (!deps.resendApiKey) {
		deps.log.info(
			{
				to: payload.to,
				subject: payload.subject,
				mode: "console",
			},
			"EMAIL (dev mode — RESEND_API_KEY not configured):\n%s",
			payload.html,
		);
		return { messageId: `dev-${Date.now()}` };
	}

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${deps.resendApiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: deps.emailFrom,
			to: [payload.to],
			subject: payload.subject,
			html: payload.html,
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Resend API error (${response.status}): ${errorBody}`);
	}

	const data = (await response.json()) as { id: string };
	return { messageId: data.id };
}
