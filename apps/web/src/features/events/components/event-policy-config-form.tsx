import type {
	EventPoliciesConfigInput,
	EventPoliciesRecord,
} from "@repo/shared/schemas";
import { eventPoliciesConfigSchema } from "@repo/shared/schemas";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ApiClientError } from "#/lib/api-client.shared";
import { toastRetry } from "@/components/design-system";
import { updateEventPolicies } from "../api";
import { eventPolicyRecordToConfigValues } from "../policy-config-values";
import { eventPoliciesQueryKey } from "../queries";

function getErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Failed to update event policies. Please try again.";
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

function ValidationSummary({ value }: { value: EventPoliciesConfigInput }) {
	const result = eventPoliciesConfigSchema.safeParse(value);
	if (result.success) return null;

	const messages = Array.from(
		new Set(result.error.issues.map((issue) => issue.message)),
	);

	return (
		<Alert variant="destructive">
			<AlertTitle>Fix policy settings</AlertTitle>
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

interface EventPolicyConfigFormProps {
	eventId: string;
	initialPolicies?: EventPoliciesRecord | null;
}

export function EventPolicyConfigForm({
	eventId,
	initialPolicies,
}: EventPolicyConfigFormProps) {
	const queryClient = useQueryClient();
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const defaults = eventPolicyRecordToConfigValues(initialPolicies);

	const mutation = useMutation({
		mutationFn: (config: EventPoliciesConfigInput) =>
			updateEventPolicies({ data: { eventId, config } }),
		onSuccess: (policies) => {
			void queryClient.invalidateQueries({
				queryKey: eventPoliciesQueryKey(eventId),
			});
			form.reset(eventPolicyRecordToConfigValues(policies));
			setLastSavedAt(new Date().toISOString());
			toast.success("Event policies updated");
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
			onChange: eventPoliciesConfigSchema,
		},
		onSubmit: ({ value }) => {
			const parsed = eventPoliciesConfigSchema.safeParse(value);
			if (!parsed.success) {
				toast.error(
					parsed.error.issues[0]?.message ??
						"Please fix the highlighted policies and try again.",
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
						Participant-facing policies
					</CardTitle>
					<CardDescription>
						Refund and cancellation terms are displayed to participants before
						registration and should be finalized before publishing.
					</CardDescription>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Configure event policies</CardTitle>
					<CardDescription>
						Use clear plain text. Policy text is trimmed and validated by the
						API.
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

						<form.Field name="refundPolicy">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Refund policy</Label>
									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										rows={8}
										aria-describedby={`${field.name}-help ${field.name}-error`}
										aria-invalid={field.state.meta.errors.length > 0}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
									/>
									<p
										id={`${field.name}-help`}
										className="text-muted-foreground text-xs"
									>
										Explain refund eligibility, deadlines, fees, and processing
										timelines.
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

						<form.Field name="cancellationPolicy">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Cancellation policy</Label>
									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										rows={8}
										aria-describedby={`${field.name}-help ${field.name}-error`}
										aria-invalid={field.state.meta.errors.length > 0}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
									/>
									<p
										id={`${field.name}-help`}
										className="text-muted-foreground text-xs"
									>
										Explain organizer cancellation, postponement, and
										participant communication rules.
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

						<Separator />

						{mutation.isError ? (
							<Alert variant="destructive">
								<AlertTitle>Could not save policies</AlertTitle>
								<AlertDescription>
									{getErrorMessage(mutation.error)}
								</AlertDescription>
							</Alert>
						) : null}

						{lastSavedAt ? (
							<Alert>
								<AlertTitle>Policies saved</AlertTitle>
								<AlertDescription>
									Your event refund and cancellation policies were saved
									successfully.
								</AlertDescription>
							</Alert>
						) : null}

						<form.Subscribe
							selector={(state) => [state.canSubmit, state.isSubmitting]}
						>
							{([canSubmit, isSubmitting]) => (
								<Button
									type="submit"
									className="w-full"
									disabled={!canSubmit || mutation.isPending}
								>
									{mutation.isPending || isSubmitting
										? "Saving policies..."
										: "Save policies"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
