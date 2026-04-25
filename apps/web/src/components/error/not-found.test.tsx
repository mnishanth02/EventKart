import { cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundPage } from "./not-found";

type MockProps = React.PropsWithChildren<Record<string, unknown>>;

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...props }: MockProps) => (
		<a href={to as string} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({ children, asChild, ...props }: MockProps) => {
		if (asChild) return <>{children}</>;
		return <button {...props}>{children}</button>;
	},
}));

vi.mock("lucide-react", () => ({
	SearchX: (props: Record<string, unknown>) => (
		<span data-testid="search-icon" {...props} />
	),
}));

describe("NotFoundPage", () => {
	afterEach(() => {
		cleanup();
	});
	it("renders 404 text", () => {
		render(<NotFoundPage />);
		const heading = screen.getByText("404");
		expect(heading).toBeDefined();
	});

	it("renders 'Page not found' heading", () => {
		render(<NotFoundPage />);
		const headings = screen.getAllByRole("heading", { level: 2 });
		const heading = headings.find((h) => h.textContent === "Page not found");
		expect(heading).toBeDefined();
	});

	it("renders description text", () => {
		render(<NotFoundPage />);
		const paragraphs = screen.getAllByText(
			"The page you're looking for doesn't exist or has been moved.",
		);
		expect(paragraphs.length).toBeGreaterThan(0);
	});

	it("renders 'Go Home' link pointing to '/'", () => {
		render(<NotFoundPage />);
		const link = screen.getByRole("link", { name: /go home/i });
		expect(link).toBeDefined();
		expect(link.getAttribute("href")).toBe("/");
	});
});
