import { eventSchema } from "@repo/shared/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type React from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateEvent } from "../api";
import { eventQueryKey } from "../queries";
import type { Event } from "../types";
import { EventEditForm } from "./event-edit-form";

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		promise: vi.fn(),
	},
}));

vi.mock("../api", () => ({
	updateEvent: vi.fn(),
}));

vi.mock("@repo/ui/components/ui/badge", () => ({
	Badge: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<span {...props}>{children}</span>
	),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({
		children,
		variant: _variant,
		size: _size,
		asChild: _asChild,
		...props
	}: React.PropsWithChildren<
		Record<string, unknown> & {
			variant?: unknown;
			size?: unknown;
			asChild?: unknown;
		}
	>) => <button {...props}>{children}</button>,
}));

vi.mock("@repo/ui/components/ui/card", () => ({
	Card: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardContent: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardDescription: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardHeader: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardTitle: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
}));

vi.mock("@repo/ui/components/ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} />
	),
}));

vi.mock("@repo/ui/components/ui/label", () => ({
	Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (
		// biome-ignore lint/a11y/noLabelWithoutControl: test mock receives htmlFor from the component under test.
		<label {...props} />
	),
}));

vi.mock("@repo/ui/components/ui/textarea", () => ({
	Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
		<textarea {...props} />
	),
}));

const eventId = "11111111-1111-4111-8111-111111111111";

const event = eventSchema.parse({
	id: eventId,
	organizerId: "22222222-2222-4222-8222-222222222222",
	slug: "coimbatore-city-10k",
	title: "Coimbatore City 10K",
	description:
		"A paid running event for Coimbatore runners with a clearly marked city route.",
	eventType: "race",
	sport: "running",
	category: "running",
	venueName: "Race Course Grounds",
	addressLine1: "Race Course Road, Gopalapuram",
	addressLine2: null,
	city: "Coimbatore",
	state: "Tamil Nadu",
	country: "India",
	postalCode: null,
	timezone: "Asia/Kolkata",
	startAt: "2026-08-15T00:30:00.000Z",
	endAt: "2026-08-15T03:30:00.000Z",
	registrationOpensAt: "2026-07-01T03:30:00.000Z",
	registrationClosesAt: "2026-08-14T12:30:00.000Z",
	routeDetails: "Single-loop 10K route through Race Course Road.",
	refundPolicy: null,
	cancellationPolicy: null,
	publishedAt: null,
	submittedForReviewAt: null,
	isPaid: true,
	currency: "INR",
	status: "draft",
	createdAt: "2026-04-26T12:00:00.000Z",
	updatedAt: "2026-04-26T12:00:00.000Z",
});

function renderForm(initialEvent: Event = event) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	queryClient.setQueryData(eventQueryKey(initialEvent.id), initialEvent);

	render(
		<QueryClientProvider client={queryClient}>
			<EventEditForm event={initialEvent} />
		</QueryClientProvider>,
	);

	return { queryClient };
}

describe("EventEditForm", () => {
	beforeEach(() => {
		vi.mocked(updateEvent).mockReset();
		vi.mocked(toast.success).mockReset();
		vi.mocked(toast.error).mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("initializes editable fields from the event and summarizes immutable values", () => {
		renderForm();

		expect(screen.getByDisplayValue("Coimbatore City 10K")).toBeDefined();
		expect(screen.getByDisplayValue("2026-08-15T06:00")).toBeDefined();
		expect(screen.getByText("Immutable V1 settings")).toBeDefined();
		expect(screen.getByText("Coimbatore, Tamil Nadu, India")).toBeDefined();
		expect(screen.getByText("Paid (INR)")).toBeDefined();
	});

	it("shows validation feedback for invalid editable fields", async () => {
		renderForm();

		const title = screen.getByLabelText(/Event title/i);
		fireEvent.change(title, { target: { value: "No" } });
		fireEvent.blur(title);

		expect(
			await screen.findByText("Event title must be at least 3 characters"),
		).toBeDefined();
		expect(updateEvent).not.toHaveBeenCalled();
	});

	it("submits editable fields, invalidates the event query, and resets to the response", async () => {
		const updatedEvent = eventSchema.parse({
			...event,
			title: "Updated Coimbatore City 10K",
			updatedAt: "2026-04-26T12:15:00.000Z",
		});
		vi.mocked(updateEvent).mockResolvedValueOnce(updatedEvent);
		const { queryClient } = renderForm();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		fireEvent.change(screen.getByLabelText(/Event title/i), {
			target: { value: "Updated Coimbatore City 10K" },
		});

		const submitButton = screen.getByRole("button", {
			name: "Save Event Details",
		}) as HTMLButtonElement;
		await waitFor(() => expect(submitButton.disabled).toBe(false));
		fireEvent.click(submitButton);

		await waitFor(() =>
			expect(updateEvent).toHaveBeenCalledWith({
				data: {
					eventId,
					event: expect.objectContaining({
						title: "Updated Coimbatore City 10K",
						venueName: "Race Course Grounds",
						startAt: "2026-08-15T00:30:00.000Z",
					}),
				},
			}),
		);
		const payload = vi.mocked(updateEvent).mock.calls[0]?.[0].data.event;
		expect(payload).not.toHaveProperty("eventType");
		expect(payload).not.toHaveProperty("city");
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: eventQueryKey(eventId),
		});
		expect(toast.success).toHaveBeenCalledWith("Event details updated");
		await waitFor(() =>
			expect(
				screen.getByDisplayValue("Updated Coimbatore City 10K"),
			).toBeDefined(),
		);
	});

	it("shows an error toast when the update fails", async () => {
		vi.mocked(updateEvent).mockRejectedValueOnce(new Error("API unavailable"));
		renderForm();

		const submitButton = screen.getByRole("button", {
			name: "Save Event Details",
		}) as HTMLButtonElement;
		await waitFor(() => expect(submitButton.disabled).toBe(false));
		fireEvent.click(submitButton);

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				"API unavailable",
				expect.objectContaining({
					action: expect.objectContaining({ label: "Retry" }),
				}),
			),
		);
	});
});
