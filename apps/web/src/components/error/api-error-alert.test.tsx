import { describe, expect, it, vi, beforeEach } from "vitest";
import type React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ApiErrorAlert } from "./api-error-alert";
import { ApiClientError } from "#/lib/api-client.shared";

type MockProps = React.PropsWithChildren<Record<string, unknown>>;

vi.mock("@repo/ui/components/ui/alert", () => ({
	Alert: ({ children, ...props }: MockProps) => <div role="alert" {...props}>{children}</div>,
	AlertTitle: ({ children, ...props }: MockProps) => <div data-slot="alert-title" {...props}>{children}</div>,
	AlertDescription: ({ children, ...props }: MockProps) => <div data-slot="alert-description" {...props}>{children}</div>,
}));

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({ children, ...props }: MockProps) => <button {...props}>{children}</button>,
}));

vi.mock("@repo/ui/lib/utils", () => ({
	cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
	AlertCircle: (props: Record<string, unknown>) => <span data-testid="alert-icon" {...props} />,
	X: (props: Record<string, unknown>) => <span data-testid="x-icon" {...props} />,
}));

describe("ApiErrorAlert", () => {
	beforeEach(() => {
		cleanup();
	});
	it("returns null when error is null", () => {
		const { container } = render(<ApiErrorAlert error={null} />);
		expect(container.firstChild).toBeNull();
	});

	it("shows user-friendly message for 401 ApiClientError", () => {
		const error = new ApiClientError(401, "UNAUTHORIZED", "Unauthorized");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("Please sign in to continue")).toBeDefined();
	});

	it("shows user-friendly message for 403 ApiClientError", () => {
		const error = new ApiClientError(403, "FORBIDDEN", "Forbidden");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("You don't have permission to perform this action")).toBeDefined();
	});

	it("shows user-friendly message for 404 ApiClientError", () => {
		const error = new ApiClientError(404, "NOT_FOUND", "Not Found");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("The requested resource was not found")).toBeDefined();
	});

	it("shows user-friendly message for 409 ApiClientError", () => {
		const error = new ApiClientError(409, "CONFLICT", "Conflict");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("This action conflicts with existing data")).toBeDefined();
	});

	it("shows user-friendly message for 422 ApiClientError", () => {
		const error = new ApiClientError(422, "UNPROCESSABLE_ENTITY", "Unprocessable Entity");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("Please check your input and try again")).toBeDefined();
	});

	it("shows user-friendly message for 429 ApiClientError", () => {
		const error = new ApiClientError(429, "TOO_MANY_REQUESTS", "Too Many Requests");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("Too many requests. Please wait a moment and try again.")).toBeDefined();
	});

	it("shows user-friendly message for 500 ApiClientError", () => {
		const error = new ApiClientError(500, "INTERNAL_SERVER_ERROR", "Internal Server Error");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("Something went wrong on our end. Please try again later.")).toBeDefined();
	});

	it("shows error's own message for other status codes", () => {
		const error = new ApiClientError(418, "TEAPOT", "I am a teapot");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("I am a teapot")).toBeDefined();
	});

	it("shows error code text", () => {
		const error = new ApiClientError(401, "SOME_CODE", "Unauthorized");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText(/Error code: SOME_CODE/)).toBeDefined();
	});

	it("shows error.message for generic Error instances", () => {
		const error = new Error("Something went wrong");
		render(<ApiErrorAlert error={error} />);
		expect(screen.getByText("Something went wrong")).toBeDefined();
	});

	it("does NOT show error code for generic Error instances", () => {
		const error = new Error("Something went wrong");
		render(<ApiErrorAlert error={error} />);
		expect(screen.queryByText(/Error code:/)).toBeNull();
	});

	it("calls onDismiss when dismiss button is clicked", () => {
		const onDismiss = vi.fn();
		const error = new ApiClientError(401, "UNAUTHORIZED", "Unauthorized");
		render(<ApiErrorAlert error={error} onDismiss={onDismiss} />);
		const dismissButton = screen.getByLabelText("Dismiss");
		fireEvent.click(dismissButton);
		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it("does NOT render dismiss button when onDismiss is not provided", () => {
		const error = new ApiClientError(401, "UNAUTHORIZED", "Unauthorized");
		render(<ApiErrorAlert error={error} />);
		expect(screen.queryByLabelText("Dismiss")).toBeNull();
	});
});
