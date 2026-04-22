import { BlockList } from "node:net";
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../lib/config.js";
import { IpNotAllowedError } from "../lib/errors.js";

/** Extract the IPv4 address from an IPv4-mapped IPv6 address (::ffff:x.x.x.x). */
function normalizeIp(ip: string): string {
	if (ip.startsWith("::ffff:")) {
		return ip.slice(7);
	}
	return ip;
}

/**
 * Determine the IP type for BlockList methods.
 * Returns "ipv6" if the address contains a colon, otherwise "ipv4".
 */
function detectIpType(ip: string): "ipv4" | "ipv6" {
	return ip.includes(":") ? "ipv6" : "ipv4";
}

/**
 * Factory that returns a Fastify preHandler restricting access by client IP.
 *
 * - When `ADMIN_IP_ALLOWLIST` is unset, returns a no-op (all IPs allowed).
 * - When set, parses the comma-separated list of IPs/CIDRs once and checks
 *   every request against it. Non-matching IPs receive 403.
 *
 * @example
 * const middleware = createIpAllowlistMiddleware(app.config, app.log);
 * app.get("/admin/dashboard", { onRequest: [middleware] }, handler);
 */
export function createIpAllowlistMiddleware(
	config: AppConfig,
	logger?: FastifyBaseLogger,
) {
	const allowlistConfig = config.ADMIN_IP_ALLOWLIST;

	if (!allowlistConfig) {
		logger?.warn(
			"ADMIN_IP_ALLOWLIST is not configured — admin IP restriction is DISABLED",
		);
		return async function noopAllowlist(
			_request: FastifyRequest,
			_reply: FastifyReply,
		): Promise<void> {
			// No-op: allowlist not configured
		};
	}

	const blockList = new BlockList();
	const entries = allowlistConfig.split(",").map((e) => e.trim());

	for (const entry of entries) {
		if (!entry) continue;

		try {
			if (entry.includes("/")) {
				const [ip, prefixStr] = entry.split("/");
				const prefix = Number.parseInt(prefixStr ?? "", 10);
				if (!ip || Number.isNaN(prefix)) {
					logger?.warn({ entry }, "Skipping invalid CIDR entry in ADMIN_IP_ALLOWLIST");
					continue;
				}
				blockList.addSubnet(ip, prefix, detectIpType(ip));
			} else {
				blockList.addAddress(entry, detectIpType(entry));
			}
		} catch (err) {
			logger?.warn(
				{ entry, err },
				"Skipping invalid entry in ADMIN_IP_ALLOWLIST",
			);
		}
	}

	return async function checkIpAllowlist(
		request: FastifyRequest,
		_reply: FastifyReply,
	): Promise<void> {
		const clientIp = normalizeIp(request.ip);
		const ipType = detectIpType(clientIp);

		if (!blockList.check(clientIp, ipType)) {
			request.log.warn(
				{ ip: clientIp },
				"Admin access denied: IP not in allowlist",
			);
			throw new IpNotAllowedError();
		}
	};
}
