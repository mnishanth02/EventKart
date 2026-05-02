import type { OrganizerRegistrationInput } from "@repo/shared/schemas";
import { organizerRegistrationSchema } from "@repo/shared/schemas";
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
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiClientError } from "#/lib/api-client.shared";
import { toastRetry } from "@/components/design-system";
import { registerOrganizer } from "../api";
import { ORGANIZER_QUERY_KEY } from "../queries";

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

function hasRequiredRegistrationValues(values: OrganizerRegistrationInput) {
	return (
		values.businessName.trim().length > 0 &&
		values.contactName.trim().length > 0 &&
		values.contactEmail.trim().length > 0 &&
		values.contactPhone.trim().length > 0 &&
		values.city.trim().length > 0
	);
}

export function OrganizerRegistrationForm() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (data: OrganizerRegistrationInput) =>
			registerOrganizer({ data }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ORGANIZER_QUERY_KEY,
			});
			toast.success("Organizer profile created successfully!");
			void navigate({ to: "/org" });
		},
		onError: (error: unknown) => {
			if (error instanceof ApiClientError && error.status === 409) {
				toast.error("You already have an organizer profile.");
				void navigate({ to: "/org" });
				return;
			}
			toastRetry(
				error instanceof Error
					? error.message
					: "Failed to create organizer profile. Please try again.",
				{ onRetry: () => form.handleSubmit() },
			);
		},
	});

	const form = useForm({
		defaultValues: {
			businessName: "",
			contactName: "",
			contactEmail: "",
			contactPhone: "",
			city: "",
			description: undefined,
			website: undefined,
		} as OrganizerRegistrationInput,
		validators: {
			onChange: organizerRegistrationSchema,
			onSubmit: organizerRegistrationSchema,
		},
		onSubmit: ({ value }) => {
			mutation.mutate(value);
		},
	});

	return (
		<Card className="mx-auto max-w-2xl">
			<CardHeader>
				<CardTitle className="text-2xl">Register as Organizer</CardTitle>
				<CardDescription>
					Fill in your business details to create your organizer profile. You
					can start creating events once your profile is verified.
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
					{/* Business Name */}
					<form.Field name="businessName">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>
									Business Name <span className="text-destructive">*</span>
								</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									placeholder="Acme Events"
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

					{/* Contact Name */}
					<form.Field name="contactName">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>
									Contact Name <span className="text-destructive">*</span>
								</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									placeholder="Jane Doe"
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

					{/* Contact Email & Phone — side by side */}
					<div className="grid gap-6 sm:grid-cols-2">
						<form.Field name="contactEmail">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>
										Contact Email <span className="text-destructive">*</span>
									</Label>
									<Input
										id={field.name}
										name={field.name}
										type="email"
										value={field.state.value}
										placeholder="jane@acme.com"
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

						<form.Field name="contactPhone">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>
										Contact Phone <span className="text-destructive">*</span>
									</Label>
									<Input
										id={field.name}
										name={field.name}
										type="tel"
										value={field.state.value}
										placeholder="+91 98765 43210"
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
					</div>

					{/* City */}
					<form.Field name="city">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>
									City <span className="text-destructive">*</span>
								</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									placeholder="Coimbatore"
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

					{/* Description (optional) */}
					<form.Field name="description">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Description</Label>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									placeholder="Tell us about your organization and the types of events you plan to host..."
									rows={4}
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

					{/* Website (optional) */}
					<form.Field name="website">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Website</Label>
								<Input
									id={field.name}
									name={field.name}
									type="url"
									value={field.state.value ?? ""}
									placeholder="https://acme-events.com"
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

					{/* Submit */}
					<form.Subscribe
						selector={(state) => [
							state.canSubmit,
							state.isSubmitting,
							hasRequiredRegistrationValues(state.values),
						]}
					>
						{([canSubmit, isSubmitting, hasRequiredValues]) => (
							<Button
								type="submit"
								className="w-full"
								disabled={!canSubmit || !hasRequiredValues || mutation.isPending}
							>
								{mutation.isPending || isSubmitting
									? "Creating Profile..."
									: "Create Organizer Profile"}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</CardContent>
		</Card>
	);
}
