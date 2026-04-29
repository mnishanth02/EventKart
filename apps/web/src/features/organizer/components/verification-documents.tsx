import type { VerificationDocumentType } from "@repo/shared/constants";
import {
	VERIFICATION_DOCUMENT_TYPE_LABELS,
	VERIFICATION_DOCUMENT_TYPES,
} from "@repo/shared/constants";
import { ALLOWED_KYC_CONTENT_TYPES } from "@repo/shared/schemas";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef } from "react";
import { toast } from "sonner";
import { toastRetry, toastUndo } from "@/components/design-system";
import {
	confirmDocumentUpload,
	deleteDocument,
	getDocumentUploadUrl,
} from "../api";
import {
	DOCUMENTS_QUERY_KEY,
	VERIFICATION_STATUS_QUERY_KEY,
	verificationDocumentsQueryOptions,
} from "../queries";
import type { VerificationDocument } from "../types";

const ACCEPT_STRING = ".pdf,.jpg,.jpeg,.png";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getStatusBadge(status: string) {
	switch (status) {
		case "uploaded":
			return <Badge variant="default">Uploaded</Badge>;
		case "pending":
			return <Badge variant="secondary">Uploading...</Badge>;
		default:
			return <Badge variant="outline">{ status }</Badge>;
	}
}

function formatFileSize(bytes: number | null): string {
	if (bytes == null) return "Unknown size";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentUploadCard({
	documentType,
	existingDoc,
	onUploadComplete,
}: {
	documentType: VerificationDocumentType;
	existingDoc: VerificationDocument | undefined;
	onUploadComplete: () => void;
}) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);

	const uploadMutation = useMutation({
		mutationFn: async (file: File) => {
			// 1. Request presigned URL
			const uploadUrl = await getDocumentUploadUrl({
				data: {
					documentType,
					fileName: file.name,
					contentType: file.type as (typeof ALLOWED_KYC_CONTENT_TYPES)[number],
				},
			});

			// 2. Upload file directly to S3
			const formData = new FormData();
			for (const [key, value] of Object.entries(uploadUrl.fields)) {
				formData.append(key, value);
			}
			formData.append("file", file);

			const uploadResponse = await fetch(uploadUrl.url, {
				method: uploadUrl.method,
				body: formData,
			});

			if (!uploadResponse.ok) {
				throw new Error("Failed to upload file to storage");
			}

			// 3. Confirm upload
			const confirmed = await confirmDocumentUpload({
				data: { documentId: uploadUrl.documentId },
			});

			return confirmed;
		},
		onSuccess: () => {
			toast.success(
				`${VERIFICATION_DOCUMENT_TYPE_LABELS[documentType]} uploaded successfully`,
			);
			onUploadComplete();
		},
		onError: (error: Error, file: File) => {
			toastRetry(error.message || "Failed to upload document", {
				onRetry: () => uploadMutation.mutate(file),
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (documentId: string) => {
			await deleteDocument({ data: { documentId } });
			return undefined;
		},
		onSuccess: (_data: undefined, _documentId: string) => {
			toastUndo(`${VERIFICATION_DOCUMENT_TYPE_LABELS[documentType]} deleted`, {
				// Full undo would re-upload the file, but we no longer have
				// the blob after deletion. Reload to let the user re-upload.
				onUndo: () => window.location.reload(),
				undoMessage: "Refreshing — please re-upload the document.",
			});
			onUploadComplete();
		},
		onError: (_error: Error, documentId: string) => {
			toastRetry("Failed to delete document", {
				onRetry: () => deleteMutation.mutate(documentId),
			});
		},
	});

	function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;

		if (file.size > MAX_FILE_SIZE) {
			toast.error("File size must not exceed 10MB");
			event.target.value = "";
			return;
		}

		if (
			!ALLOWED_KYC_CONTENT_TYPES.includes(
				file.type as (typeof ALLOWED_KYC_CONTENT_TYPES)[number],
			)
		) {
			toast.error("Only PDF, JPEG, and PNG files are accepted");
			event.target.value = "";
			return;
		}

		uploadMutation.mutate(file);
		event.target.value = "";
	}

	const isUploading = uploadMutation.isPending;
	const isDeleting = deleteMutation.isPending;
	const isUploaded = existingDoc?.status === "uploaded";
	const documentLabel = VERIFICATION_DOCUMENT_TYPE_LABELS[documentType];
	const fileInputDescriptionId = `${inputId}-description`;

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle className="text-base">{ documentLabel }</CardTitle>
					{ existingDoc ? getStatusBadge(existingDoc.status) : null }
				</div>
				{ isUploaded && existingDoc ? (
					<CardDescription>
						{ existingDoc.fileName } · { formatFileSize(existingDoc.fileSize) }
					</CardDescription>
				) : null }
			</CardHeader>
			<CardContent>
				<Input
					ref={ inputRef }
					id={ inputId }
					type="file"
					className="hidden"
					accept={ ACCEPT_STRING }
					onChange={ handleFileSelect }
					disabled={ isUploading || isDeleting }
					tabIndex={ -1 }
					aria-hidden="true"
				/>
				<span id={ fileInputDescriptionId } className="sr-only">
					Accepted formats: PDF, JPEG, PNG. Maximum file size: 10MB.
				</span>
				{ isUploaded && existingDoc ? (
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={ isUploading || isDeleting }
							onClick={ () => inputRef.current?.click() }
							aria-describedby={ fileInputDescriptionId }
							aria-label={ `Replace ${documentLabel}` }
						>
							{ isUploading ? "Replacing..." : "Replace" }
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={ isDeleting }
							onClick={ () => deleteMutation.mutate(existingDoc.id) }
							aria-label={ `Delete ${documentLabel}` }
						>
							{ isDeleting ? "Deleting..." : "Delete" }
						</Button>
					</div>
				) : (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={ isUploading }
						onClick={ () => inputRef.current?.click() }
						aria-describedby={ fileInputDescriptionId }
						aria-label={ `Upload ${documentLabel}` }
					>
						{ isUploading ? "Uploading..." : "Upload" }
					</Button>
				) }
				{ isUploading || isDeleting ? (
					<p className="sr-only" role="status" aria-live="polite">
						{ isUploading
							? `${documentLabel} upload in progress`
							: `${documentLabel} deletion in progress` }
					</p>
				) : null }
			</CardContent>
		</Card>
	);
}

export function VerificationDocuments() {
	const queryClient = useQueryClient();
	const {
		data: documents = [],
		isError,
		isLoading,
		refetch,
	} = useQuery(verificationDocumentsQueryOptions());

	function handleUploadComplete() {
		void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
		void queryClient.invalidateQueries({
			queryKey: VERIFICATION_STATUS_QUERY_KEY,
		});
	}

	// Map existing docs by type for quick lookup
	const docsByType = new Map<string, VerificationDocument>();
	for (const doc of documents) {
		if (doc.status === "uploaded" || doc.status === "pending") {
			docsByType.set(doc.documentType, doc);
		}
	}

	const uploadedCount = documents.filter((d) => d.status === "uploaded").length;
	const totalRequired = VERIFICATION_DOCUMENT_TYPES.length;

	if (isLoading) {
		return (
			<div className="space-y-4">
				<h2 className="text-xl font-semibold">Verification Documents</h2>
				<p className="text-muted-foreground" role="status" aria-live="polite">
					Loading documents...
				</p>
			</div>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Verification Documents</CardTitle>
					<CardDescription>
						We couldn&apos;t load your uploaded documents.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button type="button" onClick={ () => refetch() }>
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold">Verification Documents</h2>
				<p className="text-muted-foreground">
					Upload your verification documents to complete your organizer profile.
					All documents are encrypted at rest.
				</p>
				<p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
					{ uploadedCount } of { totalRequired } documents uploaded
					{ uploadedCount === totalRequired ? " ✓" : "" }
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				{ VERIFICATION_DOCUMENT_TYPES.map((docType) => (
					<DocumentUploadCard
						key={ docType }
						documentType={ docType }
						existingDoc={ docsByType.get(docType) }
						onUploadComplete={ handleUploadComplete }
					/>
				)) }
			</div>

			<p className="text-xs text-muted-foreground">
				Accepted formats: PDF, JPEG, PNG. Maximum file size: 10MB.
			</p>
		</div>
	);
}
