import { defineEventHandler, setResponseHeaders } from "h3";

export default defineEventHandler((event) => {
	const isDev = process.env.NODE_ENV === "development";
	const posthogHost = process.env.VITE_POSTHOG_HOST;

	// Build CSP directives
	const scriptSrc = isDev ? "'self' 'unsafe-eval'" : "'self'";
	const connectSrcParts = ["'self'"];
	if (isDev) {
		connectSrcParts.push("ws:");
	}
	if (posthogHost) {
		connectSrcParts.push(posthogHost);
	}
	const connectSrc = connectSrcParts.join(" ");

	const cspDirectives = [
		"default-src 'self'",
		`script-src ${scriptSrc}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self'",
		`connect-src ${connectSrc}`,
		"frame-src 'none'",
		"frame-ancestors 'none'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	];

	if (!isDev) {
		cspDirectives.push("upgrade-insecure-requests");
	}

	const csp = cspDirectives.join("; ");

	setResponseHeaders(event, {
		"Content-Security-Policy": csp,
		"X-Frame-Options": "DENY",
		"X-Content-Type-Options": "nosniff",
		"Strict-Transport-Security":
			"max-age=31536000; includeSubDomains; preload",
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"Permissions-Policy":
			"camera=(), microphone=(), geolocation=(), payment=()",
		"X-DNS-Prefetch-Control": "off",
	});
});
