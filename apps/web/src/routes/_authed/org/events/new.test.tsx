import { cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
	queryOptions: (options: unknown) => options,
	useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
	Link: ({
		children,
		to,
	}: React.PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a>,
}));

vi.mock("#/features/events/components/event-create-form", () => ({
	EventCreateForm: () => <div>Create running event</div>,
}));

import { NewEventPage } from "./new";

type QueryKeyish =
	| readonly unknown[]
	| { queryKey: readonly unknown[] }
	| undefined;

function getQueryKey(args: unknown[]): readonly unknown[] {
	const first = args[0] as QueryKeyish;
	if (Array.isArray(first)) return first;
	if (first && typeof first === "object" && "queryKey" in first) {
		return (first as { queryKey: readonly unknown[] }).queryKey;
	}
	return [];
}

function isProfileKey(key: readonly unknown[]) {
	return key[0] === "organizer" && key[1] === "profile";
}

function isPolicyKey(key: readonly unknown[]) {
	return key[0] === "organizer" && key[1] === "policies";
}

interface QueryState {
	data?: unknown;
	isLoading?: boolean;
	isError?: boolean;
	refetch?: () => void;
}

function setupQueries({
	profile,
	policy,
}: {
	profile: QueryState;
	policy?: QueryState;
}) {
	mockUseQuery.mockReset();
	mockUseQuery.mockImplementation((...args: unknown[]) => {
		const key = getQueryKey(args);
		if (isProfileKey(key)) {
			return {
				data: profile.data ?? null,
				isLoading: profile.isLoading ?? false,
				isError: profile.isError ?? false,
				refetch: profile.refetch ?? vi.fn(),
			};
		}
		if (isPolicyKey(key)) {
			return {
				data: policy?.data ?? null,
				isLoading: policy?.isLoading ?? false,
				isError: policy?.isError ?? false,
				refetch: policy?.refetch ?? vi.fn(),
			};
		}
		return { data: null, isLoading: false, isError: false, refetch: vi.fn() };
	});
}

afterEach(() => {
	cleanup();
	mockUseQuery.mockReset();
});

describe("NewEventPage", () => {
	it("renders the EventCreateForm when profile and required policies are accepted", () => {
		setupQueries({
			profile: { data: { businessName: "Acme" } },
			policy: { data: { allRequiredAccepted: true, policies: [] } },
		});

		render(<NewEventPage />);

		expect(screen.getByText("Create running event")).toBeTruthy();
	});

	it("shows the Complete Your Profile CTA when no organizer profile exists", () => {
		setupQueries({ profile: { data: null } });

		render(<NewEventPage />);

		expect(screen.getByText("Complete Your Profile")).toBeTruthy();
		expect(screen.queryByText("Create running event")).toBeNull();
	});

	it("shows the Accept Platform Policies CTA when required policies are missing", () => {
		setupQueries({
			profile: { data: { businessName: "Acme" } },
			policy: { data: { allRequiredAccepted: false, policies: [] } },
		});

		render(<NewEventPage />);

		expect(screen.getByText("Accept Platform Policies")).toBeTruthy();
		expect(screen.queryByText("Create running event")).toBeNull();
	});
});
