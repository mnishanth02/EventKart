import type {
	EventCategoryRecord,
	EventPricingTierWithCategory,
} from "@repo/shared/schemas";
import { eventCategoryRecordSchema } from "@repo/shared/schemas";
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
import { updateEventPricing } from "../api";
import { EventPricingConfigForm } from "./event-pricing-config-form";

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		promise: vi.fn(),
	},
}));

vi.mock("../api", () => ({
	updateEventPricing: vi.fn(),
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

const categories: EventCategoryRecord[] = [
	{
		id: "22222222-2222-4222-8222-222222222222",
		eventId,
		name: "5K",
		slug: "5k",
		distanceMeters: 5000,
		sortOrder: 0,
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
	},
	{
		id: "33333333-3333-4333-8333-333333333333",
		eventId,
		name: "10K",
		slug: "10k",
		distanceMeters: 10000,
		sortOrder: 1,
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
	},
].map((category) => eventCategoryRecordSchema.parse(category));

const pricingTiers: EventPricingTierWithCategory[] = [
	{
		id: "44444444-4444-4444-8444-444444444444",
		eventId,
		eventCategoryId: categories[0]?.id ?? "",
		basePrice: 75_000,
		earlyBirdPrice: 60_000,
		earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
		category: categories[0] as EventCategoryRecord,
	},
	{
		id: "55555555-5555-4555-8555-555555555555",
		eventId,
		eventCategoryId: categories[1]?.id ?? "",
		basePrice: 100_000,
		earlyBirdPrice: null,
		earlyBirdDeadline: null,
		createdAt: "2026-04-26T12:00:00.000Z",
		updatedAt: "2026-04-26T12:00:00.000Z",
		category: categories[1] as EventCategoryRecord,
	},
];

function renderForm(
	initialPricingTiers: EventPricingTierWithCategory[] = pricingTiers,
) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<EventPricingConfigForm
				eventId={eventId}
				categories={categories}
				initialPricingTiers={initialPricingTiers}
			/>
		</QueryClientProvider>,
	);
}

describe("EventPricingConfigForm", () => {
	beforeEach(() => {
		vi.mocked(updateEventPricing).mockReset();
		vi.mocked(toast.success).mockReset();
		vi.mocked(toast.error).mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders one pricing tier per event category", () => {
		renderForm([]);

		expect(screen.getByText("5K")).toBeDefined();
		expect(screen.getByText("10K")).toBeDefined();
		expect(screen.getAllByDisplayValue("75000")).toHaveLength(2);
	});

	it("shows validation feedback for invalid early-bird pricing", async () => {
		renderForm();

		const earlyBirdInputs = screen.getAllByLabelText(
			"Early-bird price (paise)",
		);
		fireEvent.change(earlyBirdInputs[0] as HTMLInputElement, {
			target: { value: "75000" },
		});
		fireEvent.blur(earlyBirdInputs[0] as HTMLInputElement);

		expect(
			await screen.findAllByText(
				"Early-bird price must be lower than base price",
			),
		).toHaveLength(2);
		const submitButton = screen.getByRole("button", {
			name: "Save pricing",
		}) as HTMLButtonElement;
		await waitFor(() => expect(submitButton.disabled).toBe(true));
	});

	it("submits the validated pricing config", async () => {
		vi.mocked(updateEventPricing).mockResolvedValueOnce(pricingTiers);
		renderForm(pricingTiers);

		const submitButton = screen.getByRole("button", {
			name: "Save pricing",
		}) as HTMLButtonElement;
		await waitFor(() => expect(submitButton.disabled).toBe(false));

		fireEvent.click(submitButton);

		await waitFor(() =>
			expect(updateEventPricing).toHaveBeenCalledWith({
				data: {
					eventId,
					config: {
						tiers: [
							{
								eventCategoryId: categories[0]?.id,
								basePrice: 75_000,
								earlyBirdPrice: 60_000,
								earlyBirdDeadline: "2026-07-01T03:30:00.000Z",
							},
							{
								eventCategoryId: categories[1]?.id,
								basePrice: 100_000,
								earlyBirdPrice: null,
								earlyBirdDeadline: null,
							},
						],
					},
				},
			}),
		);
		expect(toast.success).toHaveBeenCalledWith("Event pricing updated");
	});
});
