import type {
	EventCategoryRecord,
	EventPricingConfigInput,
	EventPricingTierWithCategory,
} from "@repo/shared/schemas";
import { eventPricingConfigSchema } from "@repo/shared/schemas";
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
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ApiClientError } from "#/lib/api-client.shared";
import { updateEventPricing } from "../api";
import { eventPricingRecordsToConfigValues } from "../pricing-config-values";
import { eventPricingQueryKey } from "../queries";

function getErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Failed to update event pricing. Please try again.";
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

function ValidationSummary({ value }: { value: EventPricingConfigInput }) {
	const result = eventPricingConfigSchema.safeParse(value);
	if (result.success) return null;

	const messages = Array.from(
		new Set(result.error.issues.map((issue) => issue.message)),
	);

	return (
		<Alert variant="destructive">
			<AlertTitle>Fix pricing settings</AlertTitle>
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

function formatInr(value: number | null | undefined): string {
	if (typeof value !== "number" || !Number.isFinite(value)) return "Not set";
	return `₹${(value / 100).toLocaleString("en-IN")}`;
}

interface EventPricingConfigFormProps {
	eventId: string;
	categories: readonly EventCategoryRecord[];
	initialPricingTiers?: readonly EventPricingTierWithCategory[] | null;
}

export function EventPricingConfigForm({
	eventId,
	categories,
	initialPricingTiers,
}: EventPricingConfigFormProps) {
	const queryClient = useQueryClient();
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const defaults = eventPricingRecordsToConfigValues(
		categories,
		initialPricingTiers,
	);
	const categoryById = new Map(
		categories.map((category) => [category.id, category] as const),
	);

	const mutation = useMutation({
		mutationFn: (config: EventPricingConfigInput) =>
			updateEventPricing({ data: { eventId, config } }),
		onSuccess: (tiers) => {
			void queryClient.invalidateQueries({
				queryKey: eventPricingQueryKey(eventId),
			});
			form.reset(eventPricingRecordsToConfigValues(categories, tiers));
			setLastSavedAt(new Date().toISOString());
			toast.success("Event pricing updated");
		},
		onError: (error: unknown) => {
			setLastSavedAt(null);
			toast.error(getErrorMessage(error));
		},
	});

	const form = useForm({
		defaultValues: defaults,
		validators: {
			onChange: eventPricingConfigSchema,
		},
		onSubmit: ({ value }) => {
			const parsed = eventPricingConfigSchema.safeParse(value);
			if (!parsed.success) {
				toast.error(
					parsed.error.issues[0]?.message ??
						"Please fix the highlighted pricing tiers and try again.",
				);
				return;
			}
			setLastSavedAt(null);
			mutation.mutate(parsed.data);
		},
	});

	if (categories.length === 0) {
		return (
			<Alert>
				<AlertTitle>Configure categories first</AlertTitle>
				<AlertDescription>
					Pricing tiers are linked to event categories. Save at least one
					distance category before setting prices.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="mx-auto max-w-5xl space-y-6">
			<Card className="border-dashed bg-muted/30">
				<CardHeader>
					<CardTitle className="text-base">Server-validated pricing</CardTitle>
					<CardDescription>
						Base and early-bird prices are saved per distance category. Booking
						will re-check the current tier server-side before payment.
					</CardDescription>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Configure event pricing</CardTitle>
					<CardDescription>
						Set base prices and optional early-bird discounts for each event
						category.
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

						<form.Field name="tiers" mode="array">
							{(tiersField) => (
								<div className="space-y-4">
									{tiersField.state.value.map((tier, index) => {
										const category = categoryById.get(tier.eventCategoryId);
										return (
											<Card key={tier.eventCategoryId}>
												<CardHeader className="pb-3">
													<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
														<div>
															<CardTitle className="text-base">
																{category?.name ?? "Unknown category"}
															</CardTitle>
															<CardDescription>
																{category
																	? `${category.distanceMeters.toLocaleString("en-IN")} m · ${category.slug}`
																	: tier.eventCategoryId}
															</CardDescription>
														</div>
														<div className="flex flex-wrap gap-2">
															<Badge variant="secondary">
																Base {formatInr(tier.basePrice)}
															</Badge>
															{tier.earlyBirdPrice ? (
																<Badge variant="default">
																	Early {formatInr(tier.earlyBirdPrice)}
																</Badge>
															) : null}
														</div>
													</div>
												</CardHeader>
												<CardContent className="grid gap-4 md:grid-cols-3">
													<form.Field name={`tiers[${index}].basePrice`}>
														{(field) => (
															<div className="space-y-2">
																<Label htmlFor={field.name}>
																	Base price (paise)
																</Label>
																<Input
																	id={field.name}
																	name={field.name}
																	type="number"
																	min={1}
																	step={1}
																	value={
																		Number.isFinite(field.state.value)
																			? String(field.state.value)
																			: ""
																	}
																	aria-describedby={`${field.name}-error`}
																	aria-invalid={
																		field.state.meta.errors.length > 0
																	}
																	onBlur={field.handleBlur}
																	onChange={(event) =>
																		field.handleChange(
																			event.target.value === ""
																				? Number.NaN
																				: event.target.valueAsNumber,
																		)
																	}
																/>
																{field.state.meta.isTouched ? (
																	<FormFieldError
																		id={`${field.name}-error`}
																		errors={field.state.meta.errors}
																	/>
																) : null}
															</div>
														)}
													</form.Field>

													<form.Field name={`tiers[${index}].earlyBirdPrice`}>
														{(field) => (
															<div className="space-y-2">
																<Label htmlFor={field.name}>
																	Early-bird price (paise)
																</Label>
																<Input
																	id={field.name}
																	name={field.name}
																	type="number"
																	min={1}
																	step={1}
																	value={
																		typeof field.state.value === "number" &&
																		Number.isFinite(field.state.value)
																			? String(field.state.value)
																			: ""
																	}
																	placeholder="Optional"
																	aria-describedby={`${field.name}-error`}
																	aria-invalid={
																		field.state.meta.errors.length > 0
																	}
																	onBlur={field.handleBlur}
																	onChange={(event) =>
																		field.handleChange(
																			event.target.value === ""
																				? null
																				: event.target.valueAsNumber,
																		)
																	}
																/>
																{field.state.meta.isTouched ? (
																	<FormFieldError
																		id={`${field.name}-error`}
																		errors={field.state.meta.errors}
																	/>
																) : null}
															</div>
														)}
													</form.Field>

													<form.Field
														name={`tiers[${index}].earlyBirdDeadline`}
													>
														{(field) => (
															<div className="space-y-2">
																<Label htmlFor={field.name}>
																	Early-bird deadline
																</Label>
																<Input
																	id={field.name}
																	name={field.name}
																	type="text"
																	value={field.state.value ?? ""}
																	placeholder="2026-07-01T03:30:00.000Z"
																	aria-describedby={`${field.name}-help ${field.name}-error`}
																	aria-invalid={
																		field.state.meta.errors.length > 0
																	}
																	onBlur={field.handleBlur}
																	onChange={(event) =>
																		field.handleChange(
																			event.target.value.trim() === ""
																				? null
																				: event.target.value,
																		)
																	}
																/>
																<p
																	id={`${field.name}-help`}
																	className="text-muted-foreground text-xs"
																>
																	Use ISO date-time with timezone.
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
												</CardContent>
											</Card>
										);
									})}
								</div>
							)}
						</form.Field>

						<Separator />

						{mutation.isError ? (
							<Alert variant="destructive">
								<AlertTitle>Could not save pricing</AlertTitle>
								<AlertDescription>
									{getErrorMessage(mutation.error)}
								</AlertDescription>
							</Alert>
						) : null}

						{lastSavedAt ? (
							<Alert>
								<AlertTitle>Pricing saved</AlertTitle>
								<AlertDescription>
									Your event pricing tiers were saved successfully.
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
										? "Saving pricing..."
										: "Save pricing"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
