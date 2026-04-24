import * as Sentry from "@sentry/tanstackstart-react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorFallback } from "./error-fallback";

type MockProps = React.PropsWithChildren<Record<string, unknown>>;

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({ children, ...props }: MockProps) => (
		<button {...props}>{children}</button>
	),
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
}));

vi.mock("lucide-react", () => ({
	AlertTriangle: (props: Record<string, unknown>) => (
		<span data-testid="alert-icon" {...props} />
	),
}));

describe("ErrorFallback", () => {
	const mockReset = vi.fn();
	const mockError = new Error("Test error message");
	mockError.stack = "Error: Test error message\n  at test.tsx:10";

	beforeEach(() => {
		mockReset.mockClear();
		vi.mocked(Sentry.captureException).mockClear();
	});

	afterEach(() => {
		cleanup();
		import.meta.env.DEV = true;
	});

	it("renders 'Something went wrong' heading", () => {
		render(<ErrorFallback error={mockError} reset={mockReset} />);
		const heading = screen.getByRole("heading", {
			name: /something went wrong/i,
		});
		expect(heading).toBeTruthy();
	});

	it("renders 'Try Again' button", () => {
		render(<ErrorFallback error={mockError} reset={mockReset} />);
		const button = screen.getByRole("button", { name: /try again/i });
		expect(button).toBeTruthy();
	});

	it("calls reset() when 'Try Again' button is clicked", () => {
		render(<ErrorFallback error={mockError} reset={mockReset} />);
		const button = screen.getByRole("button", { name: /try again/i });
		fireEvent.click(button);
		expect(mockReset).toHaveBeenCalledTimes(1);
	});

	it("shows error message in dev mode", () => {
		import.meta.env.DEV = true;
		render(<ErrorFallback error={mockError} reset={mockReset} />);
		expect(screen.getByText("Error details (development)")).toBeTruthy();
		expect(screen.getByText("Test error message")).toBeTruthy();
		expect(screen.getByText(/Error: Test error message/)).toBeTruthy();
	});

	it("shows 'An unexpected error occurred' in production mode", () => {
		import.meta.env.DEV = false;
		render(<ErrorFallback error={mockError} reset={mockReset} />);
		expect(
			screen.getByText("An unexpected error occurred. Please try again."),
		).toBeTruthy();
		expect(screen.queryByText("Error details (development)")).toBeNull();
	});

	it("renders the alert icon", () => {
		render(<ErrorFallback error={mockError} reset={mockReset} />);
		const icon = screen.getByTestId("alert-icon");
		expect(icon).toBeTruthy();
	});

	it("captures each distinct error once", () => {
		const { rerender } = render(
			<ErrorFallback error={mockError} reset={mockReset} />,
		);

		expect(Sentry.captureException).toHaveBeenCalledTimes(1);
		expect(Sentry.captureException).toHaveBeenNthCalledWith(1, mockError);

		rerender(<ErrorFallback error={mockError} reset={mockReset} />);
		expect(Sentry.captureException).toHaveBeenCalledTimes(1);

		const nextError = new Error("Another error");
		rerender(<ErrorFallback error={nextError} reset={mockReset} />);

		expect(Sentry.captureException).toHaveBeenCalledTimes(2);
		expect(Sentry.captureException).toHaveBeenNthCalledWith(2, nextError);
	});
});
