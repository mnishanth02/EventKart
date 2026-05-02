import { describe, expect, it } from "vitest";

import { Route } from "./health";

type ServerOptions = {
	handlers?: { GET?: (req: Request) => Promise<Response> | Response };
};

function getHandler(): (req: Request) => Promise<Response> | Response {
	const server = (Route.options as { server?: ServerOptions }).server;
	const handler = server?.handlers?.GET;
	if (typeof handler !== "function") {
		throw new Error("Expected /health route to expose a GET server handler");
	}
	return handler;
}

describe("/health route", () => {
	it("responds 200 with { status: 'ok' } and Cache-Control: no-store", async () => {
		const handler = getHandler();
		const response = await handler(
			new Request("http://localhost/health", { method: "GET" }),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		await expect(response.json()).resolves.toEqual({ status: "ok" });
	});
});
