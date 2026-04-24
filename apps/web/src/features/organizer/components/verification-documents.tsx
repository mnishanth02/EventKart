import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	VERIFICATION_DOCUMENT_TYPES,
	VERIFICATION_DOCUMENT_TYPE_LABELS,
} from "@repo/shared/constants";
import type { VerificationDocumentType } from "@repo/shared/constants";
import type { VerificationDocument } from "../types";
import { ALLOWED_KYC_CONTENT_TYPES } from "@repo/shared/schemas";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { toast } from "sonner";
import {
	getDocumentUploadUrl,
	confirmDocumentUpload,
	deleteDocument,
} from "../api";
import {
	DOCUMENTS_QUERY_KEY,
	verificationDocumentsQueryOptions,
} from "../queries";

const ACCEPT_STRING = ".pdf,.jpg,.jpeg,.png";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getStatusBadge(status: string) {
	switch (status) {
		case "uploaded":
			return <Badge variant="default">Uploaded</Badge>;
		case "pending":
			return <Badge variant="secondary">Uploading...</Badge>;
		default:
			return <Badge variant="outline">{status}</Badge>;
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
			const uploadResponse = await fetch(uploadUrl.url, {
				method: uploadUrl.method,
				headers: uploadUrl.headers,
				body: file,
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
		onError: (error: Error) => {
			toast.error(error.message || "Failed to upload document");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (documentId: string) => {
			await deleteDocument({ data: { documentId } });
		},
		onSuccess: () => {
			toast.success(
				`${VERIFICATION_DOCUMENT_TYPE_LABELS[documentType]} deleted`,
			);
			onUploadComplete();
		},
		onError: () => {
			toast.error("Failed to delete document");
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

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">
						{VERIFICATION_DOCUMENT_TYPE_LABELS[documentType]}
					</CardTitle>
					{existingDoc ? getStatusBadge(existingDoc.status) : null}
				</div>
				{isUploaded && existingDoc ? (
					<CardDescription>
						{existingDoc.fileName} · {formatFileSize(existingDoc.fileSize)}
					</CardDescription>
				) : null}
			</CardHeader>
			<CardContent>
				{isUploaded && existingDoc ? (
					<div className="flex gap-2">
						<label className="cursor-pointer">
							<Button
								variant="outline"
								size="sm"
								disabled={isUploading}
								asChild
							>
								<span>{isUploading ? "Replacing..." : "Replace"}</span>
							</Button>
							<input
								type="file"
								className="hidden"
								accept={ACCEPT_STRING}
								onChange={handleFileSelect}
								disabled={isUploading || isDeleting}
							/>
						</label>
						<Button
							variant="ghost"
							size="sm"
							disabled={isDeleting}
							onClick={() => deleteMutation.mutate(existingDoc.id)}
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</Button>
					</div>
				) : (
					<label className="cursor-pointer">
						<Button
							variant="outline"
							size="sm"
							disabled={isUploading}
							asChild
						>
							<span>{isUploading ? "Uploading..." : "Upload"}</span>
						</Button>
						<input
							type="file"
							className="hidden"
							accept={ACCEPT_STRING}
							onChange={handleFileSelect}
							disabled={isUploading}
						/>
					</label>
				)}
			</CardContent>
		</Card>
	);
}

export function VerificationDocuments() {
	const queryClient = useQueryClient();
	const { data: documents = [], isLoading } = useQuery(
		verificationDocumentsQueryOptions(),
	);

	function handleUploadComplete() {
		void queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
	}

	// Map existing docs by type for quick lookup
	const docsByType = new Map<string, VerificationDocument>();
	for (const doc of documents) {
		if (doc.status === "uploaded" || doc.status === "pending") {
			docsByType.set(doc.documentType, doc);
		}
	}

	const uploadedCount = documents.filter(
		(d) => d.status === "uploaded",
	).length;
	const totalRequired = VERIFICATION_DOCUMENT_TYPES.length;

	if (isLoading) {
		return (
			<div className="space-y-4">
				<h2 className="text-xl font-semibold">Verification Documents</h2>
				<p className="text-muted-foreground">Loading documents...</p>
			</div>
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
				<p className="text-sm text-muted-foreground mt-1">
					{uploadedCount} of {totalRequired} documents uploaded
					{uploadedCount === totalRequired ? " ✓" : ""}
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				{VERIFICATION_DOCUMENT_TYPES.map((docType) => (
					<DocumentUploadCard
						key={docType}
						documentType={docType}
						existingDoc={docsByType.get(docType)}
						onUploadComplete={handleUploadComplete}
					/>
				))}
			</div>

			<p className="text-xs text-muted-foreground">
				Accepted formats: PDF, JPEG, PNG. Maximum file size: 10MB.
			</p>
		</div>
	);
}
