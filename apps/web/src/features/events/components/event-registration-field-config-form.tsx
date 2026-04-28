import {
	EVENT_REGISTRATION_FIELD_CATALOG,
	type EventRegistrationFieldId,
	FITNESS_REGISTRATION_FIELD_IDS,
	STANDARD_REGISTRATION_FIELD_IDS,
} from "@repo/shared/constants";
import type { EventRegistrationFormInput } from "@repo/shared/schemas";
import { eventRegistrationFormSchema } from "@repo/shared/schemas";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ComponentType, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ApiClientError } from "#/lib/api-client.shared";
import { toastRetry } from "@/components/design-system";
import { updateEventRegistrationForm } from "../api";
import { eventRegistrationFormQueryKey } from "../queries";
import {
	eventRegistrationFormToConfigValues,
	normalizeEventRegistrationFormValues,
} from "../registration-field-config-values";

function getErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Failed to update registration fields. Please try again.";
}

function FormFieldError({
	id,
	errors,
}: {
	id: string;
	errors: ReadonlyArray<unknown>;
}) {
	const messages = errors
		.filter(
			(error): error is { message: string } =>
				error != null && typeof error === "object" && "message" in error,
		)
		.map((error) => error.message);
	if (messages.length === 0) return null;
	return (
		<p id={id} className="text-sm text-destructive" role="alert">
			{messages[0]}
		</p>
	);
}

function ValidationSummary({ value }: { value: EventRegistrationFormInput }) {
	const result = eventRegistrationFormSchema.safeParse(
		normalizeEventRegistrationFormValues(value),
	);
	if (result.success) return null;

	const messages = Array.from(
		new Set(result.error.issues.map((issue) => issue.message)),
	);

	return (
		<Alert variant="destructive">
			<AlertTitle>Fix registration fields</AlertTitle>
			<AlertDescription>
				<ul className="list-disc space-y-1 pl-4">
					{messages.map((message) => (
						<li key={message}>{message}</li>
					))}
				</ul>
			</AlertDescription>
		</Alert>
	);
}

function CheckedBox({
	id,
	label,
	description,
	checked,
	disabled,
	onCheckedChange,
}: {
	id: string;
	label: string;
	description?: string;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-start gap-3">
			<Checkbox
				id={id}
				checked={checked}
				disabled={disabled}
				aria-describedby={description ? `${id}-description` : undefined}
				onCheckedChange={(value) => onCheckedChange(value === true)}
			/>
			<div className="grid gap-1.5 leading-none">
				<Label
					htmlFor={id}
					className={disabled ? "text-muted-foreground" : undefined}
				>
					{label}
				</Label>
				{description ? (
					<p id={`${id}-description`} className="text-muted-foreground text-xs">
						{description}
					</p>
				) : null}
			</div>
		</div>
	);
}

type FieldsArrayApi = {
	state: {
		value: EventRegistrationFormInput["fields"];
	};
};

type BooleanFieldApi = {
	name: string;
	state: {
		value: boolean;
		meta: {
			errors: ReadonlyArray<unknown>;
			isTouched: boolean;
		};
	};
	handleChange: (value: boolean) => void;
	handleBlur: () => void;
};

type TextFieldApi = {
	name: string;
	state: {
		value: string | undefined;
		meta: {
			errors: ReadonlyArray<unknown>;
			isTouched: boolean;
		};
	};
	handleChange: (value: string | undefined) => void;
	handleBlur: () => void;
};

type RegistrationFormAdapter = {
	Field: ComponentType<{
		name: string;
		mode?: "array";
		children: (field: never) => ReactNode;
	}>;
	setFieldValue: (field: string, value: boolean) => void;
};

function FieldGroup({
	title,
	description,
	fieldIds,
	form,
}: {
	title: string;
	description: string;
	fieldIds: readonly EventRegistrationFieldId[];
	form: RegistrationFormAdapter;
}) {
	return (
		<section className="space-y-4" aria-labelledby={`${title}-heading`}>
			<div>
				<h3 id={`${title}-heading`} className="font-semibold text-base">
					{title}
				</h3>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
			<form.Field name="fields" mode="array">
				{(fieldsField: FieldsArrayApi) => (
					<div className="grid gap-4">
						{fieldsField.state.value.map((fieldConfig, index) => {
							if (!fieldIds.includes(fieldConfig.fieldId)) return null;

							const catalogItem =
								EVENT_REGISTRATION_FIELD_CATALOG[fieldConfig.fieldId];
							const options =
								"options" in catalogItem ? catalogItem.options : undefined;
							const reasonFieldName =
								`fields[${index}].safetyCriticalReason` as const;

							return (
								<Card key={fieldConfig.fieldId}>
									<CardHeader className="pb-3">
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div>
												<CardTitle className="flex flex-wrap items-center gap-2 text-base">
													{catalogItem.label}
													{catalogItem.sensitive ? (
														<Badge variant="destructive">Sensitive</Badge>
													) : null}
												</CardTitle>
												<CardDescription>
													{catalogItem.kind}
													{options ? ` · Options: ${options.join(", ")}` : ""}
												</CardDescription>
											</div>
											<Badge
												variant={fieldConfig.enabled ? "default" : "secondary"}
											>
												{fieldConfig.enabled ? "Enabled" : "Disabled"}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid gap-4 md:grid-cols-3">
											<form.Field name={`fields[${index}].enabled`}>
												{(field: BooleanFieldApi) => (
													<CheckedBox
														id={field.name}
														label="Collect this field"
														description="Show this input on participant registration."
														checked={field.state.value}
														onCheckedChange={(checked) => {
															field.handleChange(checked);
															if (!checked) {
																form.setFieldValue(
																	`fields[${index}].required`,
																	false,
																);
																form.setFieldValue(
																	`fields[${index}].safetyCritical`,
																	false,
																);
															}
														}}
													/>
												)}
											</form.Field>
											<form.Field name={`fields[${index}].required`}>
												{(field: BooleanFieldApi) => (
													<CheckedBox
														id={field.name}
														label="Required"
														description="Participants cannot submit without it."
														checked={field.state.value}
														disabled={!fieldConfig.enabled}
														onCheckedChange={field.handleChange}
													/>
												)}
											</form.Field>
											<form.Field name={`fields[${index}].safetyCritical`}>
												{(field: BooleanFieldApi) => (
													<CheckedBox
														id={field.name}
														label="Safety-critical"
														description="Mark only fields needed for participant safety."
														checked={field.state.value}
														disabled={!fieldConfig.enabled}
														onCheckedChange={field.handleChange}
													/>
												)}
											</form.Field>
										</div>

										{catalogItem.sensitive ? (
											<form.Field name={reasonFieldName}>
												{(field: TextFieldApi) => (
													<div className="space-y-2">
														<Label htmlFor={field.name}>
															Safety-critical reason
														</Label>
														<Textarea
															id={field.name}
															name={field.name}
															value={field.state.value ?? ""}
															rows={3}
															placeholder="Explain why this sensitive field is required for event safety or operations."
															aria-describedby={`${field.name}-help ${field.name}-error`}
															aria-invalid={field.state.meta.errors.length > 0}
															onBlur={field.handleBlur}
															onChange={(event) => {
																const value = event.target.value;
																field.handleChange(
																	value.trim().length > 0 ? value : undefined,
																);
															}}
														/>
														<p
															id={`${field.name}-help`}
															className="text-muted-foreground text-xs"
														>
															Required when this sensitive field is required or
															marked safety-critical.
														</p>
														{field.state.meta.isTouched ? (
															<FormFieldError
																id={`${field.name}-error`}
																errors={field.state.meta.errors}
															/>
														) : null}
													</div>
												)}
											</form.Field>
										) : null}
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</form.Field>
		</section>
	);
}

interface EventRegistrationFieldConfigFormProps {
	eventId: string;
	initialRegistrationForm?: EventRegistrationFormInput | null;
}

export function EventRegistrationFieldConfigForm({
	eventId,
	initialRegistrationForm,
}: EventRegistrationFieldConfigFormProps) {
	const queryClient = useQueryClient();
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const defaults = eventRegistrationFormToConfigValues(initialRegistrationForm);

	const mutation = useMutation({
		mutationFn: (config: EventRegistrationFormInput) =>
			updateEventRegistrationForm({ data: { eventId, config } }),
		onSuccess: (registrationForm) => {
			void queryClient.invalidateQueries({
				queryKey: eventRegistrationFormQueryKey(eventId),
			});
			form.reset(eventRegistrationFormToConfigValues(registrationForm));
			setLastSavedAt(new Date().toISOString());
			toast.success("Registration fields updated");
		},
		onError: (error: unknown) => {
			setLastSavedAt(null);
			toastRetry(getErrorMessage(error), {
				onRetry: () => form.handleSubmit(),
			});
		},
	});

	const form = useForm({
		defaultValues: defaults,
		validators: {
			onChange: eventRegistrationFormSchema,
		},
		onSubmit: ({ value }) => {
			const normalized = normalizeEventRegistrationFormValues(value);
			const parsed = eventRegistrationFormSchema.safeParse(normalized);
			if (!parsed.success) {
				toast.error(
					parsed.error.issues[0]?.message ??
						"Please fix the highlighted registration fields and try again.",
				);
				return;
			}
			setLastSavedAt(null);
			mutation.mutate(parsed.data);
		},
	});

	return (
		<div className="mx-auto max-w-5xl space-y-6">
			<Card className="border-dashed bg-muted/30">
				<CardHeader>
					<CardTitle className="text-base">
						Server-validated registration form
					</CardTitle>
					<CardDescription>
						Choose the standard and fitness-specific participant fields for this
						event. Sensitive fields stay optional by default and require a
						safety reason when made required or safety-critical.
					</CardDescription>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Configure registration fields</CardTitle>
					<CardDescription>
						These settings are validated with the shared schema before they are
						sent to the organizer API.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							form.handleSubmit();
						}}
						className="space-y-6"
					>
						<form.Subscribe selector={(state) => state.values}>
							{(value) => <ValidationSummary value={value} />}
						</form.Subscribe>

						<FieldGroup
							title="Standard fields"
							description="Core participant identity and contact fields."
							fieldIds={STANDARD_REGISTRATION_FIELD_IDS}
							form={form as unknown as RegistrationFormAdapter}
						/>

						<Separator />

						<FieldGroup
							title="Fitness-specific fields"
							description="Race-day logistics and safety fields for endurance events."
							fieldIds={FITNESS_REGISTRATION_FIELD_IDS}
							form={form as unknown as RegistrationFormAdapter}
						/>

						{mutation.isError ? (
							<Alert variant="destructive">
								<AlertTitle>Could not save registration fields</AlertTitle>
								<AlertDescription>
									{getErrorMessage(mutation.error)}
								</AlertDescription>
							</Alert>
						) : null}

						{lastSavedAt ? (
							<Alert>
								<AlertTitle>Registration fields saved</AlertTitle>
								<AlertDescription>
									Last saved at {new Date(lastSavedAt).toLocaleString()}.
								</AlertDescription>
							</Alert>
						) : null}

						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-muted-foreground text-sm">
								Disabled fields are never required or safety-critical when
								saved.
							</p>
							<form.Subscribe
								selector={(state) => ({
									canSubmit: state.canSubmit,
									isSubmitting: state.isSubmitting,
								})}
							>
								{({ canSubmit, isSubmitting }) => (
									<Button
										type="submit"
										disabled={!canSubmit || isSubmitting || mutation.isPending}
									>
										{mutation.isPending
											? "Saving..."
											: "Save registration fields"}
									</Button>
								)}
							</form.Subscribe>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
