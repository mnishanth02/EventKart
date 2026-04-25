import type { OrganizerUpdateInput } from "@repo/shared/schemas";
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
import { VerifiedBadge } from "@repo/ui/components/verified-badge";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateOrganizerProfile } from "../api";
import { ORGANIZER_QUERY_KEY } from "../queries";
import type { OrganizerProfile } from "../types";

function FormFieldError({ errors }: { errors: ReadonlyArray<unknown> }) {
	const messages = errors
		.filter(
			(e): e is { message: string } =>
				e != null && typeof e === "object" && "message" in e,
		)
		.map((e) => e.message);
	if (messages.length === 0) return null;
	return (
		<p className="text-sm text-destructive" role="alert">
			{messages[0]}
		</p>
	);
}

/**
 * Computes a partial update payload containing only the fields that
 * differ from the original profile. Returns `null` when nothing changed.
 */
function getChangedFields(
	original: OrganizerProfile,
	current: OrganizerUpdateInput,
): OrganizerUpdateInput | null {
	const changes: Record<string, unknown> = {};

	const fields = [
		"businessName",
		"contactName",
		"contactEmail",
		"contactPhone",
		"city",
		"description",
		"website",
	] as const;

	for (const key of fields) {
		const originalValue = original[key] ?? undefined;
		const currentValue = current[key] ?? undefined;
		if (currentValue !== originalValue) {
			changes[key] = currentValue;
		}
	}

	return Object.keys(changes).length > 0
		? (changes as OrganizerUpdateInput)
		: null;
}

interface OrganizerProfileFormProps {
	profile: OrganizerProfile;
}

export function OrganizerProfileForm({ profile }: OrganizerProfileFormProps) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (data: OrganizerUpdateInput) =>
			updateOrganizerProfile({ data }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ORGANIZER_QUERY_KEY,
			});
			toast.success("Profile updated successfully");
		},
		onError: (error: unknown) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update profile. Please try again.",
			);
		},
	});

	const form = useForm({
		defaultValues: {
			businessName: profile.businessName,
			contactName: profile.contactName,
			contactEmail: profile.contactEmail,
			contactPhone: profile.contactPhone,
			city: profile.city,
			description: profile.description ?? undefined,
			website: profile.website ?? undefined,
		} as OrganizerUpdateInput,
		onSubmit: ({ value }) => {
			const changes = getChangedFields(profile, value);
			if (!changes) return;
			mutation.mutate(changes);
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Edit Profile
					{profile.isVerified && <VerifiedBadge variant="inline" />}
				</CardTitle>
				<CardDescription>
					Update your organizer information. Only changed fields will be
					submitted.
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
								<Label htmlFor={field.name}>Business Name</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									placeholder="Acme Events"
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.isTouched && (
									<FormFieldError errors={field.state.meta.errors} />
								)}
							</div>
						)}
					</form.Field>

					{/* Contact Name */}
					<form.Field name="contactName">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Contact Name</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									placeholder="Jane Doe"
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.isTouched && (
									<FormFieldError errors={field.state.meta.errors} />
								)}
							</div>
						)}
					</form.Field>

					{/* Contact Email & Phone — side by side */}
					<div className="grid gap-6 sm:grid-cols-2">
						<form.Field name="contactEmail">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Contact Email</Label>
									<Input
										id={field.name}
										name={field.name}
										type="email"
										value={field.state.value ?? ""}
										placeholder="jane@acme.com"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.isTouched && (
										<FormFieldError errors={field.state.meta.errors} />
									)}
								</div>
							)}
						</form.Field>

						<form.Field name="contactPhone">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Contact Phone</Label>
									<Input
										id={field.name}
										name={field.name}
										type="tel"
										value={field.state.value ?? ""}
										placeholder="+91 98765 43210"
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.isTouched && (
										<FormFieldError errors={field.state.meta.errors} />
									)}
								</div>
							)}
						</form.Field>
					</div>

					{/* City */}
					<form.Field name="city">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>City</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									placeholder="Coimbatore"
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.isTouched && (
									<FormFieldError errors={field.state.meta.errors} />
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
									placeholder="Tell us about your organization..."
									rows={4}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(e.target.value || undefined)
									}
								/>
								{field.state.meta.isTouched && (
									<FormFieldError errors={field.state.meta.errors} />
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
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(e.target.value || undefined)
									}
								/>
								{field.state.meta.isTouched && (
									<FormFieldError errors={field.state.meta.errors} />
								)}
							</div>
						)}
					</form.Field>

					{/* Submit */}
					<form.Subscribe
						selector={(state) => [
							state.canSubmit,
							state.isSubmitting,
							state.isDirty,
						]}
					>
						{([canSubmit, isSubmitting, isDirty]) => (
							<Button
								type="submit"
								className="w-full"
								disabled={!canSubmit || !isDirty || mutation.isPending}
							>
								{mutation.isPending || isSubmitting
									? "Saving Changes..."
									: "Save Changes"}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</CardContent>
		</Card>
	);
}
