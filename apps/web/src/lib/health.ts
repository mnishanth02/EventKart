/**
 * Health check helpers for the web frontend.
 * Extracted from route handlers for testability.
 */

import { serverEnv } from "#/lib/env/server";

// ── Types ──────────────────────────────────────────────────────────

export interface HealthCheck {
	name: string;
	status: "ok" | "error";
	latency_ms: number;
	message?: string;
}

export interface HealthResponse {
	status: "ok" | "degraded";
	uptime: number;
	checks: HealthCheck[];
}

// ── API Reachability Check ─────────────────────────────────────────

const API_TIMEOUT_MS = 5_000;

/**
 * Checks whether the backend API is reachable by calling its `/ready` endpoint.
 * Returns a structured health check result — never throws.
 */
export async function checkApiReachability(): Promise<HealthCheck> {
	const start = performance.now();
	const baseUrl = serverEnv.INTERNAL_API_URL ?? "http://localhost:3001";
	try {
		const res = await fetch(`${baseUrl}/ready`, {
			signal: AbortSignal.timeout(API_TIMEOUT_MS),
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		return {
			name: "api",
			status: "ok",
			latency_ms: Math.round(performance.now() - start),
		};
	} catch {
		return {
			name: "api",
			status: "error",
			latency_ms: Math.round(performance.now() - start),
			message: "API unreachable",
		};
	}
}
