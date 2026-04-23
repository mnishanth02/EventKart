import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorFallback } from "./error-fallback";

type MockProps = React.PropsWithChildren<Record<string, unknown>>;

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({ children, ...props }: MockProps) => <button {...props}>{children}</button>,
}));

vi.mock("lucide-react", () => ({
	AlertTriangle: (props: Record<string, unknown>) => <span data-testid="alert-icon" {...props} />,
}));

describe("ErrorFallback", () => {
	const mockReset = vi.fn();
	const mockError = new Error("Test error message");
	mockError.stack = "Error: Test error message\n  at test.tsx:10";

	beforeEach(() => {
		mockReset.mockClear();
	});

	afterEach(() => {
		cleanup();
		import.meta.env.DEV = true;
	});

	it("renders 'Something went wrong' heading", () => {
		render(<ErrorFallback error={mockError} reset={mockReset} />);
		const heading = screen.getByRole("heading", { name: /something went wrong/i });
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
		expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeTruthy();
		expect(screen.queryByText("Error details (development)")).toBeNull();
	});

	it("renders the alert icon", () => {
		render(<ErrorFallback error={mockError} reset={mockReset} />);
		const icon = screen.getByTestId("alert-icon");
		expect(icon).toBeTruthy();
	});
});
