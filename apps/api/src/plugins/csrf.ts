import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@repo/shared/constants";
import { CsrfError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function generateCsrfToken(sessionId: string, secret: string): string {
	const random = randomBytes(32).toString("base64url");
	const signature = createHmac("sha256", secret)
		.update(`${sessionId}:${random}`)
		.digest("base64url");
	return `${random}.${signature}`;
}

export function buildCsrfCookieOptions(cookieDomain?: string): {
	path: string;
	httpOnly: boolean;
	secure: boolean;
	sameSite: "lax";
	maxAge: number;
	domain?: string;
} {
	const options: {
		path: string;
		httpOnly: boolean;
		secure: boolean;
		sameSite: "lax";
		maxAge: number;
		domain?: string;
	} = {
		path: "/",
		httpOnly: false,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const,
		maxAge: 30 * 24 * 60 * 60,
	};

	if (cookieDomain) {
		options.domain = cookieDomain;
	}

	return options;
}

export function buildCsrfClearOptions(cookieDomain?: string): {
	path: string;
	httpOnly: boolean;
	secure: boolean;
	sameSite: "lax";
	domain?: string;
} {
	const { maxAge: _, ...clearOptions } = buildCsrfCookieOptions(cookieDomain);
	return clearOptions;
}

function timingSafeCompare(a: string, b: string): boolean {
	try {
		const bufA = Buffer.from(a);
		const bufB = Buffer.from(b);
		if (bufA.length !== bufB.length) {
			return false;
		}
		return timingSafeEqual(bufA, bufB);
	} catch {
		return false;
	}
}

const csrfPlugin: FastifyPluginAsync = async (fastify) => {
	fastify.addHook("onRequest", async (request) => {
		if (SAFE_METHODS.has(request.method)) {
			return;
		}

		if (request.isInternalRequest) {
			return;
		}

		if (request.session === null) {
			return;
		}

		const routeConfig = request.routeOptions.config;
		if (
			"csrfProtection" in routeConfig &&
			routeConfig.csrfProtection === false
		) {
			return;
		}

		const cookieToken = request.cookies[CSRF_COOKIE_NAME];
		const headerToken = request.headers[CSRF_HEADER_NAME] as
			| string
			| undefined;

		if (!cookieToken || !headerToken) {
			request.log.warn("CSRF validation failed: missing token");
			throw new CsrfError();
		}

		const tokenParts = cookieToken.split(".");
		if (tokenParts.length !== 2 || !tokenParts[0] || !tokenParts[1]) {
			request.log.warn("CSRF validation failed: malformed token");
			throw new CsrfError();
		}

		const expectedSignature = createHmac("sha256", fastify.config.CSRF_SECRET)
			.update(`${request.session.sessionId}:${tokenParts[0]}`)
			.digest("base64url");

		if (!timingSafeCompare(expectedSignature, tokenParts[1])) {
			request.log.warn("CSRF validation failed: invalid signature");
			throw new CsrfError();
		}

		if (!timingSafeCompare(headerToken, cookieToken)) {
			request.log.warn(
				"CSRF validation failed: header and cookie mismatch",
			);
			throw new CsrfError();
		}
	});
};

export default fp(csrfPlugin, {
	name: "csrf",
	dependencies: ["config", "auth", "internal-key"],
	fastify: "5.x",
});
