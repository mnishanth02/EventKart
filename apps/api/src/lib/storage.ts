import { randomUUID } from "node:crypto";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// --- Storage categories ---

export type StorageCategory = "kyc" | "event-image" | "roster-export";

export const STORAGE_PREFIXES: Record<StorageCategory, string> = {
	kyc: "kyc/",
	"event-image": "events/images/",
	"roster-export": "exports/roster/",
} as const;

// Categories requiring server-side encryption
const SSE_CATEGORIES: ReadonlySet<StorageCategory> = new Set(["kyc"]);

// --- Content policy constants (for route-level enforcement) ---

export const ALLOWED_CONTENT_TYPES: Record<
	StorageCategory,
	readonly string[]
> = {
	kyc: ["application/pdf", "image/jpeg", "image/png"],
	"event-image": ["image/jpeg", "image/png", "image/webp"],
	"roster-export": ["application/pdf", "text/csv"],
} as const;

export const MAX_FILE_SIZES: Record<StorageCategory, number> = {
	kyc: 10 * 1024 * 1024, // 10 MB
	"event-image": 5 * 1024 * 1024, // 5 MB
	"roster-export": 50 * 1024 * 1024, // 50 MB
} as const;

// --- Default URL expiry ---

const DEFAULT_UPLOAD_EXPIRY_SECONDS = 900; // 15 minutes
const DEFAULT_DOWNLOAD_EXPIRY_SECONDS = 3600; // 1 hour

// --- Key generation ---

export function generateStorageKey(
	category: StorageCategory,
	ownerId: string,
	extension: string,
): string {
	const sanitizedExt = extension
		.replace(/^\./, "")
		.replace(/[^a-zA-Z0-9]/g, "");
	const prefix = STORAGE_PREFIXES[category];
	return `${prefix}${ownerId}/${randomUUID()}.${sanitizedExt}`;
}

// --- Config + client types ---

export interface StorageClientConfig {
	endpoint: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	forcePathStyle: boolean;
}

export interface UploadUrlParams {
	category: StorageCategory;
	ownerId: string;
	extension: string;
	contentType: string;
	expiresIn?: number;
}

export interface PresignedUploadResult {
	url: string;
	method: "PUT";
	headers: Record<string, string>;
	key: string;
	expiresAt: Date;
}

export interface DownloadUrlParams {
	key: string;
	expiresIn?: number;
	responseContentDisposition?: string;
}

export interface PresignedDownloadResult {
	url: string;
	method: "GET";
	key: string;
	expiresAt: Date;
}

export interface ObjectMetadata {
	contentType: string | undefined;
	contentLength: number | undefined;
	lastModified: Date | undefined;
}

export interface StorageClient {
	getUploadUrl(params: UploadUrlParams): Promise<PresignedUploadResult>;
	getDownloadUrl(params: DownloadUrlParams): Promise<PresignedDownloadResult>;
	deleteObject(key: string): Promise<void>;
	headObject(key: string): Promise<ObjectMetadata | null>;
	destroy(): void;
	readonly enabled: boolean;
}

// --- Disabled client (used when S3 config is not provided) ---

export class StorageUnavailableError extends Error {
	constructor() {
		super(
			"Object storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET environment variables.",
		);
		this.name = "StorageUnavailableError";
	}
}

export function createDisabledStorageClient(): StorageClient {
	const unavailable = async (): Promise<never> => {
		throw new StorageUnavailableError();
	};

	return {
		getUploadUrl: unavailable,
		getDownloadUrl: unavailable,
		deleteObject: unavailable,
		headObject: unavailable,
		destroy: () => {},
		enabled: false,
	};
}

// --- Live client factory ---

export function createStorageClient(
	config: StorageClientConfig,
): StorageClient {
	const s3 = new S3Client({
		endpoint: config.endpoint,
		region: config.region,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
		forcePathStyle: config.forcePathStyle,
	});

	const bucket = config.bucket;

	return {
		async getUploadUrl(
			params: UploadUrlParams,
		): Promise<PresignedUploadResult> {
			const key = generateStorageKey(
				params.category,
				params.ownerId,
				params.extension,
			);
			const expiresIn = params.expiresIn ?? DEFAULT_UPLOAD_EXPIRY_SECONDS;
			const useSSE = SSE_CATEGORIES.has(params.category);

			const command = new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				ContentType: params.contentType,
				...(useSSE ? { ServerSideEncryption: "AES256" as const } : {}),
			});

			const url = await getSignedUrl(s3, command, { expiresIn });

			const headers: Record<string, string> = {
				"Content-Type": params.contentType,
			};
			if (useSSE) {
				headers["x-amz-server-side-encryption"] = "AES256";
			}

			return {
				url,
				method: "PUT",
				headers,
				key,
				expiresAt: new Date(Date.now() + expiresIn * 1000),
			};
		},

		async getDownloadUrl(
			params: DownloadUrlParams,
		): Promise<PresignedDownloadResult> {
			const expiresIn =
				params.expiresIn ?? DEFAULT_DOWNLOAD_EXPIRY_SECONDS;

			const command = new GetObjectCommand({
				Bucket: bucket,
				Key: params.key,
				...(params.responseContentDisposition
					? {
							ResponseContentDisposition:
								params.responseContentDisposition,
						}
					: {}),
			});

			const url = await getSignedUrl(s3, command, { expiresIn });

			return {
				url,
				method: "GET",
				key: params.key,
				expiresAt: new Date(Date.now() + expiresIn * 1000),
			};
		},

		async deleteObject(key: string): Promise<void> {
			await s3.send(
				new DeleteObjectCommand({ Bucket: bucket, Key: key }),
			);
		},

		async headObject(key: string): Promise<ObjectMetadata | null> {
			try {
				const result = await s3.send(
					new HeadObjectCommand({ Bucket: bucket, Key: key }),
				);
				return {
					contentType: result.ContentType,
					contentLength: result.ContentLength,
					lastModified: result.LastModified,
				};
			} catch (error: unknown) {
				const statusCode =
					typeof error === "object" &&
					error !== null &&
					"$metadata" in error &&
					typeof (error as Record<string, unknown>).$metadata ===
						"object"
						? (
								(
									error as Record<
										string,
										Record<string, unknown>
									>
								).$metadata as Record<string, unknown>
							).httpStatusCode
						: undefined;

				if (statusCode === 404) {
					return null;
				}

				const errorName =
					typeof error === "object" &&
					error !== null &&
					"name" in error
						? (error as { name: string }).name
						: undefined;

				if (
					errorName === "NotFound" ||
					errorName === "NoSuchKey"
				) {
					return null;
				}

				throw error;
			}
		},

		destroy(): void {
			s3.destroy();
		},

		enabled: true,
	};
}
