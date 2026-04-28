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
import { publishEvent } from "../api";
import { eventQueryKey, publishReadinessQueryKey } from "../queries";
import { PublishAction } from "./publish-action";

vi.mock("../api", () => ({
	publishEvent: vi.fn(),
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

function renderAction(props: { ready: boolean; disabledReason?: string }) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

	render(
		<QueryClientProvider client={queryClient}>
			<PublishAction eventId={eventId} {...props} />
		</QueryClientProvider>,
	);

	return { invalidateSpy };
}

describe("PublishAction", () => {
	beforeEach(() => {
		vi.mocked(publishEvent).mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("disables publish with a visible reason when readiness is not met", () => {
		renderAction({
			ready: false,
			disabledReason: "Upload a hero image before publishing.",
		});

		expect(
			screen.getByRole<HTMLButtonElement>("button", { name: "Publish event" })
				.disabled,
		).toBe(true);
		expect(
			screen.getByText("Upload a hero image before publishing."),
		).toBeDefined();
	});

	it("publishes after confirmation and invalidates event plus readiness queries", async () => {
		vi.mocked(publishEvent).mockResolvedValue({
			transition: "draft_to_published",
			event: {} as never,
			readiness: {} as never,
		});
		const { invalidateSpy } = renderAction({ ready: true });

		expect(screen.getByRole("dialog")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Confirm publish" }));

		await waitFor(() => {
			expect(publishEvent).toHaveBeenCalledWith({ data: { eventId } });
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
			"Event published.",
		);
	});

	it("shows pending state and disables confirmation while publish is in flight", async () => {
		let resolvePublish!: (
			value: Awaited<ReturnType<typeof publishEvent>>,
		) => void;
		vi.mocked(publishEvent).mockReturnValue(
			new Promise((resolve) => {
				resolvePublish = resolve;
			}) as ReturnType<typeof publishEvent>,
		);
		renderAction({ ready: true });

		fireEvent.click(screen.getByRole("button", { name: "Confirm publish" }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Publishing..." }),
			).toBeDefined();
			expect(
				screen.getByRole<HTMLButtonElement>("button", {
					name: "Confirm publish",
				}).disabled,
			).toBe(true);
		});

		resolvePublish({
			transition: "draft_to_published",
			event: {} as never,
			readiness: {} as never,
		});
	});

	it("announces no-op publish success with a specific message", async () => {
		vi.mocked(publishEvent).mockResolvedValue({
			transition: "noop_already_published",
			event: {} as never,
			readiness: {} as never,
		});
		renderAction({ ready: true });

		fireEvent.click(screen.getByRole("button", { name: "Confirm publish" }));

		expect((await screen.findByRole("status")).textContent).toBe(
			"Event was already published.",
		);
	});

	it("renders API error details and refreshes readiness after readiness-related failures", async () => {
		const error = Object.assign(new Error("Event is incomplete"), {
			code: "EVENT_INCOMPLETE",
		});
		vi.mocked(publishEvent).mockRejectedValue(error);
		const { invalidateSpy } = renderAction({ ready: true });

		fireEvent.click(screen.getByRole("button", { name: "Confirm publish" }));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"Event is incomplete (EVENT_INCOMPLETE)",
		);
		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: publishReadinessQueryKey(eventId),
			});
		});
	});
});
