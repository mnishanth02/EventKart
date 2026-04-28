import {
	defaultEventCategoriesConfig,
	type EventCategoryRecord,
} from "@repo/shared/schemas";
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
import { updateEventCategories } from "../api";
import { EventCategoryConfigForm } from "./event-category-config-form";

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		promise: vi.fn(),
	},
}));

vi.mock("../api", () => ({
	updateEventCategories: vi.fn(),
}));

vi.mock("@repo/ui/components/ui/alert", () => ({
	Alert: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div role="alert" {...props}>
			{children}
		</div>
	),
	AlertTitle: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	AlertDescription: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
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

vi.mock("@repo/ui/components/ui/separator", () => ({
	Separator: (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />,
}));

const eventId = "11111111-1111-4111-8111-111111111111";

const savedCategoryRecords = defaultEventCategoriesConfig.categories.map(
	(category, index) => ({
		...category,
		id: `33333333-3333-4333-8333-33333333333${index}`,
		eventId,
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
	}),
) as EventCategoryRecord[];

function renderForm(initialCategories: EventCategoryRecord[] = []) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<EventCategoryConfigForm
				eventId={eventId}
				initialCategories={initialCategories}
			/>
		</QueryClientProvider>,
	);
}

describe("EventCategoryConfigForm", () => {
	beforeEach(() => {
		vi.mocked(updateEventCategories).mockReset();
		vi.mocked(toast.success).mockReset();
		vi.mocked(toast.error).mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("preloads the default V1 distance categories when none exist", () => {
		renderForm();

		expect(screen.getByText("No categories configured yet")).toBeDefined();
		expect(screen.getByDisplayValue("5K")).toBeDefined();
		expect(screen.getByDisplayValue("10K")).toBeDefined();
		expect(screen.getByDisplayValue("Half Marathon")).toBeDefined();
	});

	it("supports adding and removing a category row", () => {
		renderForm();

		fireEvent.click(screen.getByRole("button", { name: "Add category" }));
		expect(screen.getByText("Category 4")).toBeDefined();

		const removeButtons = screen.getAllByRole("button", { name: "Remove" });
		fireEvent.click(
			removeButtons[removeButtons.length - 1] as HTMLButtonElement,
		);

		expect(screen.queryByText("Category 4")).toBeNull();
	});

	it("shows validation feedback and disables submit for duplicate slugs", async () => {
		renderForm();

		const slugInputs = screen.getAllByLabelText("Slug");
		fireEvent.change(slugInputs[1] as HTMLInputElement, {
			target: { value: "5k" },
		});
		fireEvent.blur(slugInputs[1] as HTMLInputElement);

		expect(
			await screen.findAllByText("Category slugs must be unique per event"),
		).toHaveLength(2);

		const submitButton = screen.getByRole("button", {
			name: "Save categories",
		}) as HTMLButtonElement;
		await waitFor(() => expect(submitButton.disabled).toBe(true));
		expect(updateEventCategories).not.toHaveBeenCalled();
	});

	it("submits the validated category config", async () => {
		vi.mocked(updateEventCategories).mockResolvedValueOnce(
			savedCategoryRecords,
		);
		renderForm(savedCategoryRecords);

		const submitButton = screen.getByRole("button", {
			name: "Save categories",
		}) as HTMLButtonElement;
		await waitFor(() => expect(submitButton.disabled).toBe(false));

		fireEvent.click(submitButton);

		await waitFor(() =>
			expect(updateEventCategories).toHaveBeenCalledWith({
				data: {
					eventId,
					config: defaultEventCategoriesConfig,
				},
			}),
		);
		expect(toast.success).toHaveBeenCalledWith("Event categories updated");
	});
});
