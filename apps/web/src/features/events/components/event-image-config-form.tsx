import type { EventImage, EventImageKind } from "@repo/shared/schemas";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { toastRetry, toastUndo } from "@/components/design-system";
import {
	confirmEventImageUpload,
	deleteEventImage,
	requestEventImageUploadUrl,
} from "../api";
import {
	EVENT_IMAGE_ACCEPT,
	formatEventImageFileSize,
	validateEventImageFile,
} from "../event-image-validation";
import { eventImagesQueryKey } from "../queries";

const IMAGE_KINDS = [
	"hero",
	"route_map",
] as const satisfies readonly EventImageKind[];

const IMAGE_KIND_LABELS = {
	hero: "Hero image",
	route_map: "Route map",
} as const satisfies Record<EventImageKind, string>;

const IMAGE_KIND_DESCRIPTIONS = {
	hero: "Upload a promotional banner used across discovery and event detail pages.",
	route_map:
		"Upload a readable route map participants can review before registering.",
} as const satisfies Record<EventImageKind, string>;

function getStatusBadge(status: EventImage["status"]) {
	switch (status) {
		case "uploaded":
			return <Badge variant="default">Uploaded</Badge>;
		case "pending":
			return <Badge variant="secondary">Pending confirmation</Badge>;
		case "replaced":
			return <Badge variant="outline">Replaced</Badge>;
		case "deleted":
			return <Badge variant="outline">Deleted</Badge>;
	}
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return "Failed to update event image. Please try again.";
}

interface ImageUploadCardProps {
	eventId: string;
	kind: EventImageKind;
	existingImage?: EventImage;
}

export function ImageUploadCard({
	eventId,
	kind,
	existingImage,
}: ImageUploadCardProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [validationError, setValidationError] = useState<string | null>(null);
	const label = IMAGE_KIND_LABELS[kind];

	useEffect(() => {
		if (!selectedFile) {
			setPreviewUrl(null);
			return;
		}

		const nextPreviewUrl = URL.createObjectURL(selectedFile);
		setPreviewUrl(nextPreviewUrl);
		return () => URL.revokeObjectURL(nextPreviewUrl);
	}, [selectedFile]);

	const uploadMutation = useMutation({
		mutationFn: async (file: File) => {
			const validation = validateEventImageFile(file);
			if (!validation.valid) {
				throw new Error(validation.message);
			}

			const uploadUrl = await requestEventImageUploadUrl({
				data: {
					eventId,
					kind,
					fileName: file.name,
					contentType: validation.contentType,
					sizeBytes: file.size,
				},
			});

			const uploadResponse = await fetch(uploadUrl.url, {
				method: uploadUrl.method,
				headers: uploadUrl.headers,
				body: file,
			});

			if (!uploadResponse.ok) {
				throw new Error("Failed to upload image to storage.");
			}

			return confirmEventImageUpload({
				data: { eventId, imageId: uploadUrl.imageId },
			});
		},
		onSuccess: () => {
			setSelectedFile(null);
			setValidationError(null);
			if (inputRef.current) inputRef.current.value = "";
			void queryClient.invalidateQueries({
				queryKey: eventImagesQueryKey(eventId),
			});
			toast.success(`${label} uploaded`);
		},
		onError: (error: unknown) => {
			const message = getErrorMessage(error);
			setValidationError(message);
			toastRetry(message, {
				onRetry: () => {
					if (selectedFile) uploadMutation.mutate(selectedFile);
				},
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (imageId: string) => {
			await deleteEventImage({ data: { eventId, imageId } });
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: eventImagesQueryKey(eventId),
			});
			toastUndo(`${label} deleted`, {
				onUndo: () => {
					// Re-uploading a deleted image is not trivial; placeholder for future undo support
				},
			});
		},
		onError: (error: unknown) => {
			toastRetry(getErrorMessage(error), {
				onRetry: () => {
					if (existingImage) deleteMutation.mutate(existingImage.id);
				},
			});
		},
	});

	function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;

		const validation = validateEventImageFile(file);
		if (!validation.valid) {
			setSelectedFile(null);
			setValidationError(validation.message);
			toast.error(validation.message);
			event.target.value = "";
			return;
		}

		setSelectedFile(file);
		setValidationError(null);
	}

	function handleClearSelectedFile() {
		setSelectedFile(null);
		setValidationError(null);
		if (inputRef.current) inputRef.current.value = "";
	}

	const isBusy = uploadMutation.isPending || deleteMutation.isPending;
	const uploadButtonLabel = existingImage
		? `Replace ${label}`
		: `Upload ${label}`;

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle className="text-base">{label}</CardTitle>
						<CardDescription>{IMAGE_KIND_DESCRIPTIONS[kind]}</CardDescription>
					</div>
					{existingImage ? getStatusBadge(existingImage.status) : null}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{existingImage ? (
					<div className="rounded-md border bg-muted/30 p-3 text-sm">
						<p className="font-medium">{existingImage.fileName}</p>
						<p className="text-muted-foreground">
							{formatEventImageFileSize(existingImage.sizeBytes)} ·{" "}
							{existingImage.contentType}
						</p>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						No {label.toLowerCase()} uploaded yet.
					</p>
				)}

				<div className="space-y-2">
					<Label htmlFor={inputId}>Choose {label.toLowerCase()} file</Label>
					<Input
						ref={inputRef}
						id={inputId}
						type="file"
						accept={EVENT_IMAGE_ACCEPT}
						disabled={isBusy}
						aria-describedby={`${inputId}-help ${inputId}-error`}
						onChange={handleFileChange}
					/>
					<p id={`${inputId}-help`} className="text-muted-foreground text-xs">
						Accepted formats: JPEG, PNG, WebP. Maximum file size: 5 MB.
					</p>
				</div>

				{previewUrl && selectedFile ? (
					<div className="space-y-2">
						<img
							src={previewUrl}
							alt={`${label} preview`}
							className="max-h-56 w-full rounded-md border object-cover"
						/>
						<p className="text-muted-foreground text-sm">
							Selected {selectedFile.name} ·{" "}
							{formatEventImageFileSize(selectedFile.size)}
						</p>
					</div>
				) : null}

				{validationError ? (
					<p
						id={`${inputId}-error`}
						className="text-sm text-destructive"
						role="alert"
					>
						{validationError}
					</p>
				) : (
					<span id={`${inputId}-error`} className="sr-only" />
				)}

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						disabled={!selectedFile || isBusy}
						onClick={() => {
							if (selectedFile) uploadMutation.mutate(selectedFile);
						}}
					>
						{uploadMutation.isPending ? "Uploading..." : uploadButtonLabel}
					</Button>
					{selectedFile ? (
						<Button
							type="button"
							variant="outline"
							disabled={isBusy}
							onClick={handleClearSelectedFile}
						>
							Clear selection
						</Button>
					) : null}
					{existingImage ? (
						<Button
							type="button"
							variant="ghost"
							disabled={isBusy}
							onClick={() => deleteMutation.mutate(existingImage.id)}
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</Button>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

interface EventImageConfigFormProps {
	eventId: string;
	images?: readonly EventImage[] | null;
}

export function EventImageConfigForm({
	eventId,
	images = [],
}: EventImageConfigFormProps) {
	const imagesByKind = new Map<EventImageKind, EventImage>();
	for (const image of images ?? []) {
		if (image.status === "pending" || image.status === "uploaded") {
			imagesByKind.set(image.kind, image);
		}
	}

	return (
		<div className="mx-auto max-w-5xl space-y-6">
			<Card className="border-dashed bg-muted/30">
				<CardHeader>
					<CardTitle className="text-base">Event images</CardTitle>
					<CardDescription>
						Images are uploaded directly to storage using presigned URLs, then
						confirmed with EventKart after the upload completes.
					</CardDescription>
				</CardHeader>
			</Card>

			<div className="grid gap-4 lg:grid-cols-2">
				{IMAGE_KINDS.map((kind) => (
					<ImageUploadCard
						key={kind}
						eventId={eventId}
						kind={kind}
						existingImage={imagesByKind.get(kind)}
					/>
				))}
			</div>
		</div>
	);
}
