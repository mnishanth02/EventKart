import {
	EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT,
	EVENT_DISTANCE_CATEGORY_PRESETS,
} from "@repo/shared/constants";
import type {
	EventCategoriesConfigInput,
	EventCategoryConfigInput,
	EventCategoryRecord,
} from "@repo/shared/schemas";
import { eventCategoriesConfigSchema } from "@repo/shared/schemas";
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
import { updateEventCategories } from "../api";
import {
	createBlankEventCategory,
	eventCategoryRecordsToConfigValues,
	getDefaultEventCategoriesConfigValues,
	normalizeEventCategorySlug,
	reindexEventCategories,
} from "../category-config-values";
import { eventCategoriesQueryKey } from "../queries";

function getErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Failed to update event categories. Please try again.";
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

function ValidationSummary({ value }: { value: EventCategoriesConfigInput }) {
	const result = eventCategoriesConfigSchema.safeParse(value);
	if (result.success) return null;

	const messages = Array.from(
		new Set(result.error.issues.map((issue) => issue.message)),
	);

	return (
		<Alert variant="destructive">
			<AlertTitle>Fix category settings</AlertTitle>
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

function PresetSummary() {
	return (
		<Card className="border-dashed bg-muted/30">
			<CardHeader>
				<CardTitle className="text-base">Default race distances</CardTitle>
				<CardDescription>
					New events start with launch-ready distance categories. You can edit
					or replace them before publishing.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				{EVENT_DISTANCE_CATEGORY_PRESETS.map((preset) => (
					<Badge key={preset.slug} variant="secondary">
						{preset.label} · {preset.distanceMeters.toLocaleString("en-IN")} m
					</Badge>
				))}
			</CardContent>
		</Card>
	);
}

function formatDistanceKm(distanceMeters: number): string {
	if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return "";
	return `${(distanceMeters / 1000).toLocaleString("en-IN", {
		maximumFractionDigits: 2,
	})} km`;
}

function getNextCategory(
	categories: readonly EventCategoryConfigInput[],
): EventCategoryConfigInput {
	const existingSlugs = new Set(categories.map((category) => category.slug));
	const preset = EVENT_DISTANCE_CATEGORY_PRESETS.find(
		(candidate) => !existingSlugs.has(candidate.slug),
	);

	if (!preset) return createBlankEventCategory(categories.length);

	return {
		name: preset.label,
		slug: preset.slug,
		distanceMeters: preset.distanceMeters,
		sortOrder: categories.length,
	};
}

interface EventCategoryConfigFormProps {
	eventId: string;
	initialCategories?: readonly EventCategoryRecord[] | null;
}

export function EventCategoryConfigForm({
	eventId,
	initialCategories,
}: EventCategoryConfigFormProps) {
	const queryClient = useQueryClient();
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const defaults = eventCategoryRecordsToConfigValues(initialCategories);
	const usesDefaultEmptyState =
		!initialCategories || initialCategories.length === 0;

	const mutation = useMutation({
		mutationFn: (config: EventCategoriesConfigInput) =>
			updateEventCategories({ data: { eventId, config } }),
		onSuccess: (categories) => {
			void queryClient.invalidateQueries({
				queryKey: eventCategoriesQueryKey(eventId),
			});
			form.reset(eventCategoryRecordsToConfigValues(categories));
			setLastSavedAt(new Date().toISOString());
			toast.success("Event categories updated");
		},
		onError: (error: unknown) => {
			setLastSavedAt(null);
			toast.error(getErrorMessage(error));
		},
	});

	const form = useForm({
		defaultValues: defaults,
		validators: {
			onChange: eventCategoriesConfigSchema,
		},
		onSubmit: ({ value }) => {
			const parsed = eventCategoriesConfigSchema.safeParse(value);
			if (!parsed.success) {
				toast.error(
					parsed.error.issues[0]?.message ??
						"Please fix the highlighted categories and try again.",
				);
				return;
			}
			setLastSavedAt(null);
			mutation.mutate(parsed.data);
		},
	});

	return (
		<div className="mx-auto max-w-5xl space-y-6">
			<PresetSummary />

			{usesDefaultEmptyState ? (
				<Alert>
					<AlertTitle>No categories configured yet</AlertTitle>
					<AlertDescription>
						We preloaded the default 5K, 10K, and Half Marathon categories. Save
						them as-is or customize the distances for this event.
					</AlertDescription>
				</Alert>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>Configure event categories</CardTitle>
					<CardDescription>
						Define the race distances participants can choose during
						registration. Names, slugs, and sort order must be unique.
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

						<form.Field name="categories" mode="array">
							{(categoriesField) => (
								<div className="space-y-4">
									{categoriesField.state.value.map((category, index) => (
										<Card key={`${category.slug}-${category.sortOrder}`}>
											<CardHeader className="pb-3">
												<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
													<div>
														<CardTitle className="text-base">
															Category {index + 1}
														</CardTitle>
														<CardDescription>
															Sort order {index}
															{category.distanceMeters
																? ` · ${formatDistanceKm(category.distanceMeters)}`
																: ""}
														</CardDescription>
													</div>
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={categoriesField.state.value.length <= 1}
														onClick={() => {
															const next = categoriesField.state.value.filter(
																(_, categoryIndex) => categoryIndex !== index,
															);
															form.setFieldValue(
																"categories",
																reindexEventCategories(next),
															);
														}}
													>
														Remove
													</Button>
												</div>
											</CardHeader>
											<CardContent className="space-y-4">
												<div className="grid gap-4 md:grid-cols-[1fr_1fr_180px]">
													<form.Field name={`categories[${index}].name`}>
														{(field) => (
															<div className="space-y-2">
																<Label htmlFor={field.name}>Name</Label>
																<Input
																	id={field.name}
																	name={field.name}
																	value={field.state.value}
																	placeholder="5K"
																	aria-describedby={`${field.name}-error`}
																	aria-invalid={
																		field.state.meta.errors.length > 0
																	}
																	onBlur={field.handleBlur}
																	onChange={(event) =>
																		field.handleChange(event.target.value)
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

													<form.Field name={`categories[${index}].slug`}>
														{(field) => (
															<div className="space-y-2">
																<Label htmlFor={field.name}>Slug</Label>
																<Input
																	id={field.name}
																	name={field.name}
																	value={field.state.value}
																	placeholder="5k"
																	aria-describedby={`${field.name}-error`}
																	aria-invalid={
																		field.state.meta.errors.length > 0
																	}
																	onBlur={field.handleBlur}
																	onChange={(event) =>
																		field.handleChange(
																			normalizeEventCategorySlug(
																				event.target.value,
																			),
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
														name={`categories[${index}].distanceMeters`}
													>
														{(field) => (
															<div className="space-y-2">
																<Label htmlFor={field.name}>
																	Distance (meters)
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
																	placeholder="5000"
																	aria-describedby={`${field.name}-help ${field.name}-error`}
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
																<p
																	id={`${field.name}-help`}
																	className="text-muted-foreground text-xs"
																>
																	{formatDistanceKm(field.state.value)}
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
												</div>
											</CardContent>
										</Card>
									))}

									<div className="flex flex-col gap-3 sm:flex-row">
										<Button
											type="button"
											variant="outline"
											disabled={
												categoriesField.state.value.length >=
												EVENT_DISTANCE_CATEGORY_MAX_PER_EVENT
											}
											onClick={() => {
												form.setFieldValue(
													"categories",
													reindexEventCategories([
														...categoriesField.state.value,
														getNextCategory(categoriesField.state.value),
													]),
												);
											}}
										>
											Add category
										</Button>
										<Button
											type="button"
											variant="ghost"
											onClick={() =>
												form.reset(getDefaultEventCategoriesConfigValues())
											}
										>
											Reset to defaults
										</Button>
									</div>
								</div>
							)}
						</form.Field>

						<Separator />

						{mutation.isError ? (
							<Alert variant="destructive">
								<AlertTitle>Could not save categories</AlertTitle>
								<AlertDescription>
									{getErrorMessage(mutation.error)}
								</AlertDescription>
							</Alert>
						) : null}

						{lastSavedAt ? (
							<Alert>
								<AlertTitle>Categories saved</AlertTitle>
								<AlertDescription>
									Your event distance options were saved successfully.
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
										? "Saving categories..."
										: "Save categories"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
