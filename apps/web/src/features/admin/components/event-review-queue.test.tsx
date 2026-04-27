import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { EventReviewQueue } from "./event-review-queue";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
	queryOptions: (options: unknown) => options,
	useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: React.PropsWithChildren) => <a href="/">{children}</a>,
}));

vi.mock("@repo/ui/components/ui/badge", () => ({
	Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
	}: React.PropsWithChildren<{ onClick?: () => void }>) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}));

vi.mock("@repo/ui/components/ui/card", () => ({
	Card: ({ children }: React.PropsWithChildren) => (
		<section>{children}</section>
	),
	CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
	CardDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
	CardHeader: ({ children }: React.PropsWithChildren) => (
		<header>{children}</header>
	),
	CardTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/table", () => ({
	Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
	TableBody: ({ children }: React.PropsWithChildren) => (
		<tbody>{children}</tbody>
	),
	TableCell: ({ children }: React.PropsWithChildren) => <td>{children}</td>,
	TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
	TableHeader: ({ children }: React.PropsWithChildren) => (
		<thead>{children}</thead>
	),
	TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
}));

describe("EventReviewQueue", () => {
	it("renders an empty state when there are no pending event reviews", () => {
		mockUseQuery.mockReturnValue({
			data: {
				items: [],
				meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
			},
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});

		render(<EventReviewQueue />);

		expect(screen.getByText("No events are waiting for review.")).toBeTruthy();
	});

	it("renders submitted event review rows", () => {
		mockUseQuery.mockReturnValue({
			data: {
				items: [
					{
						eventId: "11111111-1111-4111-8111-111111111111",
						organizerId: "660e8400-e29b-41d4-a716-446655440001",
						title: "Coimbatore City 10K",
						slug: "coimbatore-city-10k",
						status: "under_review",
						startAt: "2026-08-15T00:30:00.000Z",
						submittedForReviewAt: "2026-04-26T12:00:00.000Z",
						organizerBusinessName: "CoimbatoreRunners",
						organizerContactEmail: "admin@example.com",
						previouslyPublishedPaidEventCount: 2,
					},
				],
				meta: {
					page: 1,
					limit: 20,
					total: 1,
					totalPages: 1,
					hasNext: false,
					hasPrev: false,
				},
			},
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		});

		render(<EventReviewQueue />);

		expect(screen.getByText("Coimbatore City 10K")).toBeTruthy();
		expect(screen.getByText("CoimbatoreRunners")).toBeTruthy();
		expect(screen.getByText("2/3 paid events")).toBeTruthy();
	});
});
