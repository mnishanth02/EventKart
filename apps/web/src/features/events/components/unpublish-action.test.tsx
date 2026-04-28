import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unpublishEvent } from "../api";
import { eventQueryKey, publishReadinessQueryKey } from "../queries";
import { UnpublishAction } from "./unpublish-action";

vi.mock("../api", () => ({
	unpublishEvent: vi.fn(),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({
		children,
		variant: _variant,
		asChild: _asChild,
		...props
	}: React.PropsWithChildren<
		React.ButtonHTMLAttributes<HTMLButtonElement> & {
			variant?: unknown;
			asChild?: unknown;
		}
	>) => <button {...props}>{children}</button>,
}));

vi.mock("@repo/ui/components/ui/alert-dialog", () => ({
	AlertDialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
	AlertDialogAction: ({
		children,
		...props
	}: React.PropsWithChildren<
		React.ButtonHTMLAttributes<HTMLButtonElement>
	>) => <button {...props}>{children}</button>,
	AlertDialogCancel: ({
		children,
		...props
	}: React.PropsWithChildren<
		React.ButtonHTMLAttributes<HTMLButtonElement>
	>) => <button {...props}>{children}</button>,
	AlertDialogContent: ({ children }: React.PropsWithChildren) => (
		<div role="dialog">{children}</div>
	),
	AlertDialogDescription: ({ children }: React.PropsWithChildren) => (
		<p>{children}</p>
	),
	AlertDialogFooter: ({ children }: React.PropsWithChildren) => (
		<footer>{children}</footer>
	),
	AlertDialogHeader: ({ children }: React.PropsWithChildren) => (
		<header>{children}</header>
	),
	AlertDialogTitle: ({ children }: React.PropsWithChildren) => (
		<h2>{children}</h2>
	),
	AlertDialogTrigger: ({ children }: React.PropsWithChildren) => (
		<div>{children}</div>
	),
}));

const eventId = "11111111-1111-4111-8111-111111111111";

function renderAction() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

	render(
		<QueryClientProvider client={queryClient}>
			<UnpublishAction eventId={eventId} />
		</QueryClientProvider>,
	);

	return { invalidateSpy };
}

describe("UnpublishAction", () => {
	beforeEach(() => {
		vi.mocked(unpublishEvent).mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders a confirmation dialog for the destructive visibility change", () => {
		renderAction();

		expect(
			screen.getByRole<HTMLButtonElement>("button", {
				name: "Unpublish event",
			}).disabled,
		).toBe(false);
		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByText(
				"The event will return to draft and no longer be publicly visible.",
			),
		).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
	});

	it("unpublishes after confirmation and invalidates event plus readiness queries", async () => {
		vi.mocked(unpublishEvent).mockResolvedValue({
			transition: "published_to_draft",
			event: {} as never,
		});
		const { invalidateSpy } = renderAction();

		fireEvent.click(screen.getByRole("button", { name: "Confirm unpublish" }));

		await waitFor(() => {
			expect(unpublishEvent).toHaveBeenCalledWith({ data: { eventId } });
		});
		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: eventQueryKey(eventId),
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: publishReadinessQueryKey(eventId),
			});
		});
		expect((await screen.findByRole("status")).textContent).toBe(
			"Event unpublished.",
		);
	});

	it("shows pending state and disables confirmation while unpublish is in flight", async () => {
		let resolveUnpublish!: (
			value: Awaited<ReturnType<typeof unpublishEvent>>,
		) => void;
		vi.mocked(unpublishEvent).mockReturnValue(
			new Promise((resolve) => {
				resolveUnpublish = resolve;
			}) as ReturnType<typeof unpublishEvent>,
		);
		renderAction();

		fireEvent.click(screen.getByRole("button", { name: "Confirm unpublish" }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Unpublishing..." }),
			).toBeDefined();
			expect(
				screen.getByRole<HTMLButtonElement>("button", {
					name: "Confirm unpublish",
				}).disabled,
			).toBe(true);
		});

		resolveUnpublish({
			transition: "published_to_draft",
			event: {} as never,
		});
	});

	it("announces unpublish API errors", async () => {
		vi.mocked(unpublishEvent).mockRejectedValue(
			Object.assign(new Error("Only published events can be unpublished"), {
				code: "EVENT_NOT_UNPUBLISHABLE",
			}),
		);
		renderAction();

		fireEvent.click(screen.getByRole("button", { name: "Confirm unpublish" }));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"Only published events can be unpublished (EVENT_NOT_UNPUBLISHABLE)",
		);
	});
});
