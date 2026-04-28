import { defaultEventRegistrationFormSchema } from "@repo/shared/schemas";
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
import { updateEventRegistrationForm } from "../api";
import { EventRegistrationFieldConfigForm } from "./event-registration-field-config-form";

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		promise: vi.fn(),
	},
}));

vi.mock("../api", () => ({
	updateEventRegistrationForm: vi.fn(),
}));

vi.mock("@/components/design-system", () => ({
	toastRetry: vi.fn(),
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

vi.mock("@repo/ui/components/ui/checkbox", () => ({
	Checkbox: ({
		checked,
		onCheckedChange,
		...props
	}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
		onCheckedChange?: (checked: boolean) => void;
	}) => (
		<input
			type="checkbox"
			checked={checked === true}
			onChange={(event) => onCheckedChange?.(event.target.checked)}
			{...props}
		/>
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

vi.mock("@repo/ui/components/ui/textarea", () => ({
	Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
		<textarea {...props} />
	),
}));

const eventId = "11111111-1111-4111-8111-111111111111";

function renderForm() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<EventRegistrationFieldConfigForm
				eventId={eventId}
				initialRegistrationForm={defaultEventRegistrationFormSchema}
			/>
		</QueryClientProvider>,
	);
}

function getCheckboxAt(label: string, index: number): HTMLElement {
	const checkbox = screen.getAllByLabelText(label)[index];
	if (!checkbox)
		throw new Error(`Unable to find ${label} checkbox at ${index}`);
	return checkbox;
}

function getControlAt(label: string, index: number): HTMLElement {
	const control = screen.getAllByLabelText(label)[index];
	if (!control) throw new Error(`Unable to find ${label} control at ${index}`);
	return control;
}

describe("EventRegistrationFieldConfigForm", () => {
	beforeEach(() => {
		vi.mocked(updateEventRegistrationForm).mockReset();
		vi.mocked(toast.success).mockReset();
		vi.mocked(toast.error).mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders default standard and fitness-specific registration fields", () => {
		renderForm();

		expect(screen.getByText("Standard fields")).toBeDefined();
		expect(screen.getByText("Fitness-specific fields")).toBeDefined();
		expect(screen.getByText("Full name")).toBeDefined();
		expect(screen.getByText("Date of birth")).toBeDefined();
		expect(screen.getByText("Blood group")).toBeDefined();
	});

	it("blocks required sensitive fields until a safety reason is provided", async () => {
		renderForm();

		fireEvent.click(getCheckboxAt("Collect this field", 3));
		fireEvent.click(getCheckboxAt("Required", 3));

		expect(
			await screen.findByText(
				"Sensitive fields that are required or safety-critical need a safety-critical reason",
			),
		).toBeDefined();
		expect(updateEventRegistrationForm).not.toHaveBeenCalled();
	});

	it("submits the shared-schema validated registration form", async () => {
		vi.mocked(updateEventRegistrationForm).mockResolvedValueOnce({
			...defaultEventRegistrationFormSchema,
			fields: defaultEventRegistrationFormSchema.fields.map((field) =>
				field.fieldId === "date_of_birth"
					? {
							...field,
							enabled: true,
							required: true,
							safetyCritical: false,
							safetyCriticalReason: "Needed to verify race-day age group.",
						}
					: field,
			),
		});
		renderForm();

		fireEvent.click(getCheckboxAt("Collect this field", 3));
		fireEvent.click(getCheckboxAt("Required", 3));
		await screen.findAllByLabelText("Safety-critical reason");
		fireEvent.change(getControlAt("Safety-critical reason", 0), {
			target: { value: "Needed to verify race-day age group." },
		});

		const submitButton = screen.getByRole("button", {
			name: "Save registration fields",
		}) as HTMLButtonElement;
		await waitFor(() => expect(submitButton.disabled).toBe(false));
		fireEvent.click(submitButton);

		await waitFor(() =>
			expect(updateEventRegistrationForm).toHaveBeenCalledWith({
				data: {
					eventId,
					config: {
						...defaultEventRegistrationFormSchema,
						fields: defaultEventRegistrationFormSchema.fields.map((field) =>
							field.fieldId === "date_of_birth"
								? {
										...field,
										enabled: true,
										required: true,
										safetyCritical: false,
										safetyCriticalReason:
											"Needed to verify race-day age group.",
									}
								: field,
						),
					},
				},
			}),
		);
		expect(toast.success).toHaveBeenCalledWith("Registration fields updated");
	});

	it("does not persist blank or whitespace-only reasons for optional sensitive fields", async () => {
		vi.mocked(updateEventRegistrationForm).mockResolvedValueOnce(
			defaultEventRegistrationFormSchema,
		);
		renderForm();
		await screen.findAllByLabelText("Safety-critical reason");

		fireEvent.change(getControlAt("Safety-critical reason", 0), {
			target: { value: "Temporarily typed reason" },
		});
		fireEvent.change(getControlAt("Safety-critical reason", 0), {
			target: { value: "   " },
		});

		const submitButton = screen.getByRole("button", {
			name: "Save registration fields",
		}) as HTMLButtonElement;
		await waitFor(() => expect(submitButton.disabled).toBe(false));
		fireEvent.click(submitButton);

		await waitFor(() =>
			expect(updateEventRegistrationForm).toHaveBeenCalledWith({
				data: {
					eventId,
					config: defaultEventRegistrationFormSchema,
				},
			}),
		);
	});
});
