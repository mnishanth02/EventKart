import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizerSetupGate } from "./organizer-setup-gate";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
	queryOptions: (options: unknown) => options,
	useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
	}: React.PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a>,
}));

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

describe("OrganizerSetupGate", () => {
	it("shows the profile loading state while the profile query is loading", () => {
		setupQueries({ profile: { isLoading: true } });

		render(
			<OrganizerSetupGate>
				<div>protected</div>
			</OrganizerSetupGate>,
		);

		expect(screen.getByText("Loading profile...")).toBeTruthy();
		expect(screen.queryByText("protected")).toBeNull();
	});

	it("shows the profile error card with a Retry button when the profile query errors", async () => {
		const refetch = vi.fn();
		setupQueries({ profile: { isError: true, refetch } });

		render(
			<OrganizerSetupGate>
				<div>protected</div>
			</OrganizerSetupGate>,
		);

		expect(screen.getByText("Something Went Wrong")).toBeTruthy();
		const retry = screen.getByRole("button", { name: "Retry" });
		await userEvent.click(retry);
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("shows the Complete Your Profile CTA linking to /org/register when no profile exists", () => {
		setupQueries({ profile: { data: null } });

		render(
			<OrganizerSetupGate>
				<div>protected</div>
			</OrganizerSetupGate>,
		);

		expect(screen.getByText("Complete Your Profile")).toBeTruthy();
		const link = screen.getByRole("link", {
			name: "Create Organizer Profile",
		});
		expect(link.getAttribute("href")).toBe("/org/register");
	});

	it("shows the policy loading state when the profile is loaded and the policy query is loading", () => {
		setupQueries({
			profile: { data: { businessName: "Acme" } },
			policy: { isLoading: true },
		});

		render(
			<OrganizerSetupGate>
				<div>protected</div>
			</OrganizerSetupGate>,
		);

		expect(screen.getByText("Checking policy status...")).toBeTruthy();
	});

	it("shows the policy error card with a Retry button when the policy query errors", async () => {
		const refetch = vi.fn();
		setupQueries({
			profile: { data: { businessName: "Acme" } },
			policy: { isError: true, refetch },
		});

		render(
			<OrganizerSetupGate>
				<div>protected</div>
			</OrganizerSetupGate>,
		);

		expect(screen.getByText("Something Went Wrong")).toBeTruthy();
		const retry = screen.getByRole("button", { name: "Retry" });
		await userEvent.click(retry);
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("shows the Accept Platform Policies CTA linking to /org/policies when required policies are not accepted", () => {
		setupQueries({
			profile: { data: { businessName: "Acme" } },
			policy: { data: { allRequiredAccepted: false, policies: [] } },
		});

		render(
			<OrganizerSetupGate>
				<div>protected</div>
			</OrganizerSetupGate>,
		);

		expect(screen.getByText("Accept Platform Policies")).toBeTruthy();
		const link = screen.getByRole("link", {
			name: "Review & Accept Policies",
		});
		expect(link.getAttribute("href")).toBe("/org/policies");
	});

	it("renders children when the profile is loaded and required policies are accepted", () => {
		setupQueries({
			profile: { data: { businessName: "Acme" } },
			policy: { data: { allRequiredAccepted: true, policies: [] } },
		});

		render(
			<OrganizerSetupGate>
				<div>protected</div>
			</OrganizerSetupGate>,
		);

		expect(screen.getByText("protected")).toBeTruthy();
	});
});
