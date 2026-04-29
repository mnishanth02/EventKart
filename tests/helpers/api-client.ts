/**
 * API Client helper for direct API calls in tests
 * Used for test setup and assertions
 */

const API_URL = process.env.TEST_API_URL || "http://localhost:3001";

export class APIClient {
	private baseURL: string;
	private authToken?: string;

	constructor(baseURL = API_URL) {
		this.baseURL = baseURL;
	}

	setAuthToken(token: string): void {
		this.authToken = token;
	}

	clearAuthToken(): void {
		this.authToken = undefined;
	}

	async request<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const headers: HeadersInit = {
			"Content-Type": "application/json",
			...options.headers,
		};

		if (this.authToken) {
			headers.Authorization = `Bearer ${this.authToken}`;
		}

		const response = await fetch(`${this.baseURL}${endpoint}`, {
			...options,
			headers,
		});

		if (!response.ok) {
			throw new Error(
				`API request failed: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
	}

	async get<T>(endpoint: string): Promise<T> {
		return this.request<T>(endpoint, { method: "GET" });
	}

	async post<T>(endpoint: string, data?: unknown): Promise<T> {
		return this.request<T>(endpoint, {
			method: "POST",
			body: data ? JSON.stringify(data) : undefined,
		});
	}

	async patch<T>(endpoint: string, data?: unknown): Promise<T> {
		return this.request<T>(endpoint, {
			method: "PATCH",
			body: data ? JSON.stringify(data) : undefined,
		});
	}

	async delete<T>(endpoint: string): Promise<T> {
		return this.request<T>(endpoint, { method: "DELETE" });
	}

	/**
	 * Check API health
	 */
	async checkHealth(): Promise<{ status: string }> {
		return this.get<{ status: string }>("/health");
	}

	/**
	 * Check API readiness
	 */
	async checkReady(): Promise<{ status: string }> {
		return this.get<{ status: string }>("/ready");
	}
}

export const apiClient = new APIClient();
