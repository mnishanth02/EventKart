import {
	V1_EVENT_CATEGORY,
	V1_EVENT_CITY,
	V1_EVENT_COUNTRY,
	V1_EVENT_CURRENCY,
	V1_EVENT_SPORT,
	V1_EVENT_STATE,
	V1_EVENT_TIMEZONE,
	V1_EVENT_TYPE,
} from "@repo/shared/constants";
import type { CreateEventInput } from "@repo/shared/schemas";
import { createEventInputSchema } from "@repo/shared/schemas";
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
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiClientError } from "#/lib/api-client.shared";
import { toastRetry } from "@/components/design-system";
import { createEvent } from "../api";
import {
	coimbatoreDateTimeLocalToIso,
	getDefaultCreateEventValues,
	isoToCoimbatoreDateTimeLocal,
} from "../form-values";

function FormFieldError({
	id,
	errors,
}: {
	id: string;
	errors: ReadonlyArray<unknown>;
}) {
	const messages = errors
		.filter(
			(e): e is { message: string } =>
				e != null && typeof e === "object" && "message" in e,
		)
		.map((e) => e.message);
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

function V1ConstraintSummary() {
	const constraints = [
		{ label: "Event type", value: `${V1_EVENT_TYPE} / ${V1_EVENT_SPORT}` },
		{ label: "Category", value: V1_EVENT_CATEGORY },
		{
			label: "Location",
			value: `${V1_EVENT_CITY}, ${V1_EVENT_STATE}, ${V1_EVENT_COUNTRY}`,
		},
		{ label: "Pricing", value: `Paid only (${V1_EVENT_CURRENCY})` },
		{ label: "Schedule", value: "Single-day events only" },
		{ label: "Timezone", value: V1_EVENT_TIMEZONE },
	] as const;

	return (
		<Card className="border-dashed bg-muted/30">
			<CardHeader>
				<CardTitle className="text-base">V1 event constraints</CardTitle>
				<CardDescription>
					Event creation is intentionally limited for launch readiness.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{constraints.map((constraint) => (
					<div key={constraint.label} className="space-y-1">
						<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
							{constraint.label}
						</p>
						<Badge variant="secondary">{constraint.value}</Badge>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function getErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Failed to create event. Please try again.";
}

function hasRequiredCreateEventValues(values: CreateEventInput) {
	return (
		values.title.trim().length > 0 &&
		values.description.trim().length > 0 &&
		values.venueName.trim().length > 0 &&
		values.addressLine1.trim().length > 0 &&
		values.startAt.trim().length > 0 &&
		values.endAt.trim().length > 0 &&
		values.routeDetails.trim().length > 0
	);
}

export function EventCreateForm() {
	const navigate = useNavigate();

	const mutation = useMutation({
		mutationFn: (data: CreateEventInput) => createEvent({ data }),
		onSuccess: (event) => {
			const eventReference = event.slug || event.id;
			toast.success(`Event created as a draft: ${eventReference}`);
			void navigate({
				to: "/org/events/$eventId/configure-categories",
				params: { eventId: event.id },
			});
		},
		onError: (error: unknown) => {
			toastRetry(getErrorMessage(error), {
				onRetry: () => form.handleSubmit(),
			});
		},
	});

	const form = useForm({
		defaultValues: getDefaultCreateEventValues(),
		validators: {
			onChange: createEventInputSchema,
			onSubmit: createEventInputSchema,
		},
		onSubmit: ({ value }) => {
			const parsed = createEventInputSchema.safeParse(value);
			if (!parsed.success) {
				toast.error(
					parsed.error.issues[0]?.message ??
						"Please fix the highlighted fields and try again.",
				);
				return;
			}
			mutation.mutate(parsed.data);
		},
	});

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<V1ConstraintSummary />
			<Card>
				<CardHeader>
					<CardTitle>Create running event</CardTitle>
					<CardDescription>
						Create a draft paid running event in Coimbatore. You can publish it
						after review once ticketing details are configured.
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

							<div className="space-y-2">
								<Label htmlFor="event-location">City</Label>
								<Input
									id="event-location"
									value={`${V1_EVENT_CITY}, ${V1_EVENT_STATE}`}
									disabled
									readOnly
								/>
							</div>
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

						<div className="grid gap-6 md:grid-cols-2">
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

						<div className="grid gap-6 md:grid-cols-3">
							<div className="space-y-2">
								<Label htmlFor="event-sport">Sport</Label>
								<Input
									id="event-sport"
									value={V1_EVENT_SPORT}
									disabled
									readOnly
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="event-pricing">Pricing model</Label>
								<Input
									id="event-pricing"
									value={`Paid (${V1_EVENT_CURRENCY})`}
									disabled
									readOnly
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="event-timezone">Timezone</Label>
								<Input
									id="event-timezone"
									value={V1_EVENT_TIMEZONE}
									disabled
									readOnly
								/>
							</div>
						</div>

						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
								values: state.values,
							})}
						>
							{({ canSubmit, isSubmitting, values }) => (
								<Button
									type="submit"
									className="w-full"
									disabled={
										!canSubmit ||
										!hasRequiredCreateEventValues(values) ||
										mutation.isPending
									}
								>
									{mutation.isPending || isSubmitting
										? "Creating Event..."
										: "Create Draft Event"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
