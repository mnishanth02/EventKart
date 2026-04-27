import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ApiClientError } from "#/lib/api-client.shared";
import { toastRetry } from "@/components/design-system";
import { updateEvent } from "../api";
import {
	coimbatoreDateTimeLocalToIso,
	type EventUpdatePayload,
	eventEditValuesSchema,
	eventToEditFormValues,
	isoToCoimbatoreDateTimeLocal,
} from "../form-values";
import { eventQueryKey } from "../queries";
import type { Event } from "../types";

function FormFieldError({
	id,
	errors,
}: {
	id: string;
	errors: ReadonlyArray<unknown>;
}) {
	const messages = errors
		.map((error) => {
			if (typeof error === "string") return error;
			if (error != null && typeof error === "object" && "message" in error) {
				return String(error.message);
			}
			return null;
		})
		.filter((message): message is string => Boolean(message));
	if (messages.length === 0) return null;
	return (
		<p id={id} className="text-sm text-destructive" role="alert">
			{messages[0]}
		</p>
	);
}

function RequiredMark() {
	return <span className="text-destructive">*</span>;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Failed to update event. Please try again.";
}

function ImmutableEventSummary({ event }: { event: Event }) {
	const items = [
		{ label: "Event type", value: event.eventType },
		{ label: "Sport", value: event.sport },
		{ label: "Category", value: event.category },
		{
			label: "Location",
			value: `${event.city}, ${event.state}, ${event.country}`,
		},
		{ label: "Timezone", value: event.timezone },
		{
			label: "Pricing",
			value: `${event.isPaid ? "Paid" : "Free"} (${event.currency})`,
		},
	] as const;

	return (
		<Card className="border-dashed bg-muted/30">
			<CardHeader>
				<CardTitle className="text-base">Immutable V1 settings</CardTitle>
				<CardDescription>
					These launch fields are locked after draft creation. Use the
					configuration pages for categories, pricing, policies, and images.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{items.map((item) => (
					<div key={item.label} className="space-y-1">
						<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
							{item.label}
						</p>
						<Badge variant="secondary">{item.value}</Badge>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

interface EventEditFormProps {
	event: Event;
}

export function EventEditForm({ event }: EventEditFormProps) {
	const [currentEvent, setCurrentEvent] = useState(event);
	const [formVersion, setFormVersion] = useState(0);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const formEvent = currentEvent.id === event.id ? currentEvent : event;

	return (
		<EventEditFormFields
			key={`${formEvent.id}-${formVersion}`}
			event={formEvent}
			lastSavedAt={lastSavedAt}
			onSaveError={() => setLastSavedAt(null)}
			onSaved={(updatedEvent) => {
				setCurrentEvent(updatedEvent);
				setFormVersion((version) => version + 1);
				setLastSavedAt(new Date().toISOString());
			}}
		/>
	);
}

interface EventEditFormFieldsProps extends EventEditFormProps {
	lastSavedAt: string | null;
	onSaveError: () => void;
	onSaved: (event: Event) => void;
}

function EventEditFormFields({
	event,
	lastSavedAt,
	onSaveError,
	onSaved,
}: EventEditFormFieldsProps) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (values: EventUpdatePayload) =>
			updateEvent({ data: { eventId: event.id, event: values } }),
		onSuccess: (updatedEvent) => {
			const updatedValues = eventToEditFormValues(updatedEvent);
			queryClient.setQueryData(eventQueryKey(event.id), updatedEvent);
			void queryClient.invalidateQueries({ queryKey: eventQueryKey(event.id) });
			form.reset(updatedValues);
			onSaved(updatedEvent);
			toast.success("Event details updated");
		},
		onError: (error: unknown) => {
			onSaveError();
			toastRetry(getErrorMessage(error), {
				onRetry: () => form.handleSubmit(),
			});
		},
	});

	const form = useForm({
		defaultValues: eventToEditFormValues(event),
		validators: {
			onChange: eventEditValuesSchema,
		},
		onSubmit: ({ value }) => {
			const parsed = eventEditValuesSchema.safeParse(value);
			if (!parsed.success) {
				toast.error(
					parsed.error.issues[0]?.message ??
						"Please fix the highlighted fields and try again.",
				);
				return;
			}
			onSaveError();
			mutation.mutate(parsed.data);
		},
	});

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<ImmutableEventSummary event={event} />
			<Card>
				<CardHeader>
					<CardTitle>Edit event details</CardTitle>
					<CardDescription>
						Update the pre-event details participants see before registration.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
						className="space-y-6"
					>
						<form.Field name="title">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>
										Event title <RequiredMark />
									</Label>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										placeholder="Coimbatore City 10K"
										aria-describedby={`${field.name}-error`}
										aria-invalid={field.state.meta.errors.length > 0}
										aria-required="true"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.isTouched && (
										<FormFieldError
											id={`${field.name}-error`}
											errors={field.state.meta.errors}
										/>
									)}
								</div>
							)}
						</form.Field>

						<form.Field name="description">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>
										Description <RequiredMark />
									</Label>
									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										placeholder="Describe the running event, expected audience, and race-day experience."
										rows={5}
										aria-describedby={`${field.name}-error`}
										aria-invalid={field.state.meta.errors.length > 0}
										aria-required="true"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.isTouched && (
										<FormFieldError
											id={`${field.name}-error`}
											errors={field.state.meta.errors}
										/>
									)}
								</div>
							)}
						</form.Field>

						<div className="grid gap-6 md:grid-cols-2">
							<form.Field name="venueName">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>
											Venue name <RequiredMark />
										</Label>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											placeholder="Race Course Grounds"
											aria-describedby={`${field.name}-error`}
											aria-invalid={field.state.meta.errors.length > 0}
											aria-required="true"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										{field.state.meta.isTouched && (
											<FormFieldError
												id={`${field.name}-error`}
												errors={field.state.meta.errors}
											/>
										)}
									</div>
								)}
							</form.Field>

							<form.Field name="postalCode">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Postal code</Label>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value ?? ""}
											placeholder="641018"
											aria-describedby={`${field.name}-error`}
											aria-invalid={field.state.meta.errors.length > 0}
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(e.target.value || undefined)
											}
										/>
										{field.state.meta.isTouched && (
											<FormFieldError
												id={`${field.name}-error`}
												errors={field.state.meta.errors}
											/>
										)}
									</div>
								)}
							</form.Field>
						</div>

						<form.Field name="addressLine1">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>
										Address line 1 <RequiredMark />
									</Label>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										placeholder="Race Course Road, Gopalapuram"
										aria-describedby={`${field.name}-error`}
										aria-invalid={field.state.meta.errors.length > 0}
										aria-required="true"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.isTouched && (
										<FormFieldError
											id={`${field.name}-error`}
											errors={field.state.meta.errors}
										/>
									)}
								</div>
							)}
						</form.Field>

						<form.Field name="addressLine2">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Address line 2</Label>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value ?? ""}
										placeholder="Landmark or area"
										aria-describedby={`${field.name}-error`}
										aria-invalid={field.state.meta.errors.length > 0}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(e.target.value || undefined)
										}
									/>
									{field.state.meta.isTouched && (
										<FormFieldError
											id={`${field.name}-error`}
											errors={field.state.meta.errors}
										/>
									)}
								</div>
							)}
						</form.Field>

						<div className="grid gap-6 md:grid-cols-2">
							<form.Field name="startAt">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>
											Event start <RequiredMark />
										</Label>
										<Input
											id={field.name}
											name={field.name}
											type="datetime-local"
											value={isoToCoimbatoreDateTimeLocal(field.state.value)}
											aria-describedby={`${field.name}-help ${field.name}-error`}
											aria-invalid={field.state.meta.errors.length > 0}
											aria-required="true"
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(
													coimbatoreDateTimeLocalToIso(e.target.value),
												)
											}
										/>
										<p
											id={`${field.name}-help`}
											className="text-muted-foreground text-xs"
										>
											Select the Coimbatore local date and start time.
										</p>
										{field.state.meta.isTouched && (
											<FormFieldError
												id={`${field.name}-error`}
												errors={field.state.meta.errors}
											/>
										)}
									</div>
								)}
							</form.Field>

							<form.Field name="endAt">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>
											Event end <RequiredMark />
										</Label>
										<Input
											id={field.name}
											name={field.name}
											type="datetime-local"
											value={isoToCoimbatoreDateTimeLocal(field.state.value)}
											aria-describedby={`${field.name}-help ${field.name}-error`}
											aria-invalid={field.state.meta.errors.length > 0}
											aria-required="true"
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(
													coimbatoreDateTimeLocalToIso(e.target.value),
												)
											}
										/>
										<p
											id={`${field.name}-help`}
											className="text-muted-foreground text-xs"
										>
											Must be after start and on the same Coimbatore day.
										</p>
										{field.state.meta.isTouched && (
											<FormFieldError
												id={`${field.name}-error`}
												errors={field.state.meta.errors}
											/>
										)}
									</div>
								)}
							</form.Field>
						</div>

						<div className="grid gap-6 md:grid-cols-2">
							<form.Field name="registrationOpensAt">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Registration opens</Label>
										<Input
											id={field.name}
											name={field.name}
											type="datetime-local"
											value={isoToCoimbatoreDateTimeLocal(field.state.value)}
											aria-describedby={`${field.name}-help ${field.name}-error`}
											aria-invalid={field.state.meta.errors.length > 0}
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(
													e.target.value
														? coimbatoreDateTimeLocalToIso(e.target.value)
														: undefined,
												)
											}
										/>
										<p
											id={`${field.name}-help`}
											className="text-muted-foreground text-xs"
										>
											Optional, but provide both open and close times.
										</p>
										{field.state.meta.isTouched && (
											<FormFieldError
												id={`${field.name}-error`}
												errors={field.state.meta.errors}
											/>
										)}
									</div>
								)}
							</form.Field>

							<form.Field name="registrationClosesAt">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Registration closes</Label>
										<Input
											id={field.name}
											name={field.name}
											type="datetime-local"
											value={isoToCoimbatoreDateTimeLocal(field.state.value)}
											aria-describedby={`${field.name}-help ${field.name}-error`}
											aria-invalid={field.state.meta.errors.length > 0}
											onBlur={field.handleBlur}
											onChange={(e) =>
												field.handleChange(
													e.target.value
														? coimbatoreDateTimeLocalToIso(e.target.value)
														: undefined,
												)
											}
										/>
										<p
											id={`${field.name}-help`}
											className="text-muted-foreground text-xs"
										>
											Must close before the event starts.
										</p>
										{field.state.meta.isTouched && (
											<FormFieldError
												id={`${field.name}-error`}
												errors={field.state.meta.errors}
											/>
										)}
									</div>
								)}
							</form.Field>
						</div>

						<form.Field name="routeDetails">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>
										Route details <RequiredMark />
									</Label>
									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										placeholder="Describe the running route, loop count, aid stations, and key landmarks."
										rows={4}
										aria-describedby={`${field.name}-error`}
										aria-invalid={field.state.meta.errors.length > 0}
										aria-required="true"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.isTouched && (
										<FormFieldError
											id={`${field.name}-error`}
											errors={field.state.meta.errors}
										/>
									)}
								</div>
							)}
						</form.Field>

						{lastSavedAt ? (
							<p className="text-muted-foreground text-sm" role="status">
								Last saved {new Date(lastSavedAt).toLocaleString("en-IN")}
							</p>
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
										? "Saving Event..."
										: "Save Event Details"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
