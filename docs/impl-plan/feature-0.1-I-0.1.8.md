# I-0.1.8 — Object Storage Client

**Feature ID:** I-0.1.8  
**Feature Name:** Object Storage Client  
**Status:** ✅ Complete  
**Last Updated:** 2026-04-22

## Overview

S3/R2 presigned URL helper with server-side encryption and access logging. Provides a unified storage client interface for managing object uploads/downloads with encrypted storage for sensitive documents (KYC) and audit trail support.

**Key Capabilities:**

- Presigned URL generation for secure uploads and downloads
- Server-side encryption (AES-256) for KYC documents
- Access logging to audit_log table
- Single bucket with key prefixes (kyc/, events/images/, exports/roster/)
- Cloudflare R2 or AWS S3 compatible
- Optional configuration — local development works without S3/R2

## Dependencies

**Depends On:**

- I-0.1.3 — Core database tables (audit_log)

**Used By:**

- I-1.1.2 — KYC upload
- I-1.2.9 — Event images
- Phase 5 — Roster PDFs

## Architecture Decisions

| Decision                            | Rationale                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| **Single bucket with key prefixes** | R2 charges per bucket; simpler configuration than multiple buckets                          |
| **Optional configuration**          | Local development environments can function without S3/R2 configured                        |
| **Audit logging in consumers**      | Storage client is a pure S3 wrapper; consuming modules write audit_log entries              |
| **`forcePathStyle: true`**          | Required for Cloudflare R2 compatibility                                                    |
| **SSE auto-applied for KYC prefix** | Based on key prefix detection; R2 encrypts at rest; SSE-S3 adds protection layer for AWS S3 |
| **Default URL expiry**              | 15 minutes for upload URLs, 1 hour for download URLs                                        |

## Implementation Tasks

| ID  | Task                           | Status               | Estimated Effort |
| --- | ------------------------------ | -------------------- | ---------------- |
| T1  | Install AWS SDK dependencies   | ✅ Done (2026-04-22) | 0.25h            |
| T2  | Add S3 config variables        | ✅ Done (2026-04-22) | 0.5h             |
| T3  | Create storage client library  | ✅ Done (2026-04-22) | 2h               |
| T4  | Create storage Fastify plugin  | ✅ Done (2026-04-22) | 1h               |
| T5  | Update type declarations       | ✅ Done (2026-04-22) | 0.5h             |
| T6  | Register storage plugin in app | ✅ Done (2026-04-22) | 0.25h            |
| T7  | Update .env.example            | ✅ Done (2026-04-22) | 0.25h            |
| T8  | Create tests                   | ✅ Done (2026-04-22) | 1.5h             |

**Total Estimated Effort:** 6.25 hours

## Task Details

### T1: Install AWS SDK Dependencies

**Objective:** Add required AWS SDK packages to the API application.

**Packages:**

- `@aws-sdk/client-s3@^3.x` — S3 client (R2-compatible)
- `@aws-sdk/s3-request-presigner@^3.x` — Presigned URL generation

**Location:** `apps/api`

**Acceptance Criteria:**

- ✓ Packages added to `package.json`
- ✓ Dependencies resolve without conflicts
- ✓ Can import `S3Client` and `GetObjectCommand` from `@aws-sdk/client-s3`
- ✓ Can import `getSignedUrl` from `@aws-sdk/s3-request-presigner`

---

### T2: Add S3 Config Variables

**Objective:** Add optional S3/R2 configuration to the config module.

**Location:** `apps/api/src/lib/config.ts`

**New Config Variables:**

```typescript
S3_ENDPOINT?: string       // R2/S3 endpoint URL (optional)
S3_REGION?: string         // Region, default "auto" for R2 (optional)
S3_ACCESS_KEY_ID?: string  // Access key (optional)
S3_SECRET_ACCESS_KEY?: string // Secret key (optional)
S3_BUCKET?: string         // Bucket name (optional)
```

**Implementation Notes:**

- All variables are optional (local dev may not need object storage)
- Add JSDoc comments explaining purpose and defaults
- Use environment variable parsing (e.g., `process.env.S3_ENDPOINT`)
- Export combined S3 config object

**Acceptance Criteria:**

- ✓ Config variables are exported from config module
- ✓ All variables are optional (no required validation)
- ✓ Type-safe exports with proper TypeScript inference
- ✓ No errors when variables are undefined

---

### T3: Create Storage Client Library

**Objective:** Create the core storage client module with S3 integration.

**Location:** `apps/api/src/lib/storage.ts`

**Key Constants & Exports:**

```typescript
// Storage key prefixes
const STORAGE_PREFIXES = {
  KYC: "kyc/",
  EVENT_IMAGES: "events/images/",
  EXPORT_ROSTER: "exports/roster/",
};

// Content type allow-lists per category
const ALLOWED_CONTENT_TYPES = {
  KYC: ["application/pdf", "image/jpeg", "image/png"],
  EVENT_IMAGES: ["image/jpeg", "image/png", "image/webp"],
  EXPORT_ROSTER: ["application/pdf"],
};

// Max file sizes per category (bytes)
const MAX_FILE_SIZES = {
  KYC: 10 * 1024 * 1024, // 10 MB
  EVENT_IMAGES: 5 * 1024 * 1024, // 5 MB
  EXPORT_ROSTER: 50 * 1024 * 1024, // 50 MB
};

// Default URL expiry times (seconds)
const URL_EXPIRY = {
  UPLOAD: 15 * 60, // 15 minutes
  DOWNLOAD: 60 * 60, // 1 hour
};
```

**StorageClient Interface:**

```typescript
interface StorageClient {
  getUploadUrl(
    category: "KYC" | "EVENT_IMAGES" | "EXPORT_ROSTER",
    objectKey: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<string>;

  getDownloadUrl(
    category: "KYC" | "EVENT_IMAGES" | "EXPORT_ROSTER",
    objectKey: string,
    expiresIn?: number,
  ): Promise<string>;

  deleteObject(
    category: "KYC" | "EVENT_IMAGES" | "EXPORT_ROSTER",
    objectKey: string,
  ): Promise<void>;

  headObject(
    category: "KYC" | "EVENT_IMAGES" | "EXPORT_ROSTER",
    objectKey: string,
  ): Promise<{ size: number; contentType?: string }>;

  destroy(): Promise<void>;
}
```

**Factory Function:**

```typescript
function createStorageClient(config: S3Config): StorageClient | null;
```

**Implementation Notes:**

- SSE (AES-256) automatically applied for keys with KYC prefix
- R2 requires `forcePathStyle: true` in S3Client config
- If config is incomplete, return null (graceful degradation)
- All methods throw descriptive errors on S3 failures
- Key path generators: `kyc/{documentId}/{filename}`, `events/images/{eventId}/{imageId}`, etc.

**Acceptance Criteria:**

- ✓ StorageClient interface fully typed
- ✓ `createStorageClient()` returns client or null based on config
- ✓ Presigned URLs generated with correct expiry times
- ✓ SSE automatically applied for KYC category
- ✓ All constants exported for route-level validation
- ✓ Proper error messages on S3 failures

---

### T4: Create Storage Fastify Plugin

**Objective:** Create a Fastify plugin that decorates the app with storage client.

**Location:** `apps/api/src/plugins/storage.ts`

**Plugin Behavior:**

```typescript
// Plugin registration
fastify.register(storagePlugin, {
  dependencies: ['config']
})

// Decoration
fastify.storage: StorageClient | null

// Logging
- Info log when initialized with config
- Warn log when S3 config missing (storage will be null)
- Debug logs for plugin lifecycle
```

**onClose Hook:**

- Call `fastify.storage?.destroy()` to cleanup S3 client connections

**Acceptance Criteria:**

- ✓ Plugin uses `fastify-plugin` for proper decoration
- ✓ Depends on config plugin
- ✓ Decorates `fastify.storage` correctly
- ✓ Initializes only if S3 config present
- ✓ Sets `fastify.storage = null` if config missing
- ✓ Logs warning when S3 unconfigured
- ✓ Cleanup called on fastify.close

---

### T5: Update Type Declarations

**Objective:** Extend Fastify type declarations to include storage property.

**Location:** `apps/api/src/types/fastify.d.ts`

**Update:**

```typescript
import { StorageClient } from "../lib/storage";

declare module "fastify" {
  interface FastifyInstance {
    storage: StorageClient | null;
  }
}
```

**Acceptance Criteria:**

- ✓ `fastify.storage` accessible in route handlers with correct type
- ✓ Type checking enforces optional nature (null-safe)
- ✓ No TypeScript errors in app

---

### T6: Register Storage Plugin in App

**Objective:** Load the storage plugin during app initialization.

**Location:** `apps/api/src/app.ts`

**Changes:**

- Import storage plugin
- Call `fastify.register(storagePlugin)` after config plugin
- Add to plugin dependency chain

**Acceptance Criteria:**

- ✓ Plugin registered and loaded
- ✓ Plugin loads after config plugin (dependency satisfied)
- ✓ No circular dependencies
- ✓ App starts without errors

---

### T7: Update .env.example

**Objective:** Document S3/R2 configuration variables.

**Location:** `apps/api/.env.example`

**Add:**

```bash
# Object Storage (S3/R2) — Optional
# Leave blank for local development without object storage
# S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
# S3_REGION=auto
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
# S3_BUCKET=
```

**Acceptance Criteria:**

- ✓ All S3 variables documented in .env.example
- ✓ Clear comments about optional nature
- ✓ Example values provided for Cloudflare R2

---

### T8: Create Tests

**Objective:** Create comprehensive unit and integration tests.

**Location:**

- `test/lib/storage.test.ts` — Unit tests
- `test/plugins/storage.test.ts` — Plugin tests

**Unit Tests (storage.test.ts):**

- Key generators produce correct paths per category
- Constants exported correctly
- `createStorageClient()` returns null when config incomplete
- `createStorageClient()` creates valid client when config present
- Presigned URLs expire with correct times
- SSE headers applied for KYC category only
- Error handling for S3 failures

**Plugin Tests (storage.test.ts):**

- Plugin decorates fastify.storage correctly
- Plugin initializes when S3 config present
- Plugin sets storage to null when S3 config missing
- Plugin logs warning when unconfigured
- onClose cleanup called

**Mocking Strategy:**

- Mock S3Client with jest/vitest mocks
- Mock getSignedUrl responses
- No real AWS/R2 calls in tests

**Acceptance Criteria:**

- ✓ Unit tests pass
- ✓ Plugin tests pass
- ✓ Test coverage ≥80% for storage.ts and storage plugin
- ✓ All edge cases covered (missing config, S3 errors, etc.)
- ✓ Tests use consistent patterns with existing test suite

---

## Implementation Order

Follow this sequence to ensure dependencies are satisfied:

1. **T1** → T2 (requires AWS SDK installed)
2. **T2** → T3 (T3 needs config types)
3. **T3** → T4, T5 (T4 uses storage client; T5 types it)
4. **T4** → T6 (T6 registers T4)
5. **T7** → Independent (can run in parallel)
6. **T8** → Last (tests all above)

## Testing & Validation

**Local Testing Without S3/R2:**

1. Leave all S3 config variables unset
2. Verify app starts without errors
3. Verify `fastify.storage` is null
4. Verify warning log appears

**Local Testing With S3/R2:**

1. Set S3 config variables to R2/S3 credentials
2. Verify plugin initializes successfully
3. Verify presigned URLs can be generated
4. Test with actual KYC file upload to verify SSE

**CI/CD Testing:**

- Mocked S3 tests run on every commit
- No real S3/R2 API calls in CI

## Notes

- **Audit Logging:** Consuming modules (KYC, event images, roster exports) are responsible for writing audit_log entries when generating presigned URLs. Storage client focuses on S3 operations only.
- **Content Validation:** Constants for allowed content types and max file sizes are exported from `lib/storage.ts` for route-level enforcement by consuming modules.
- **Error Messages:** Include descriptive error messages for debugging (bucket name, region, endpoint in error context).
- **Future Enhancements:** Consider implementing object lifecycle policies (auto-delete old exports), CloudFront distribution integration for downloads, or multi-part upload support for large files.

## Files to Create/Modify

| File                              | Type   | Purpose                      |
| --------------------------------- | ------ | ---------------------------- |
| `apps/api/src/lib/storage.ts`     | Create | Storage client library       |
| `apps/api/src/plugins/storage.ts` | Create | Fastify plugin               |
| `apps/api/src/lib/config.ts`      | Modify | Add S3 config variables      |
| `apps/api/src/types/fastify.d.ts` | Modify | Add storage type declaration |
| `apps/api/src/app.ts`             | Modify | Register storage plugin      |
| `apps/api/.env.example`           | Modify | Add S3 variables             |
| `test/lib/storage.test.ts`        | Create | Unit tests                   |
| `test/plugins/storage.test.ts`    | Create | Plugin tests                 |

---

**Implementation Plan Version:** 1.0  
**Document Format:** EventKart Implementation Plan (Standard)
