# I-0.3.6: API Client Setup — Hybrid Communication

**Feature ID:** I-0.3.6
**Module:** 0.3 — Frontend Application Shell
**Scope:** `apps/web` only (frontend)
**Dependencies:** None
**Downstream dependents:** I-0.2.9 (session forwarding), I-0.3.4 (error handling)

## Requirements

### Acceptance Criteria

1. **Hybrid URL selection**: SSR server functions use `INTERNAL_API_URL` (internal network); browser code uses `VITE_API_URL` (public).
2. **Internal API key**: Server-side requests attach `X-Internal-Key` header when `INTERNAL_API_KEY` env var is set.
3. **CSRF protection**: Browser-side mutating requests (POST/PUT/DELETE/PATCH) auto-read the `__csrf` cookie and attach `X-CSRF-Token` header.
4. **JSON handling**: Automatic `Content-Type: application/json` for requests with body; automatic response JSON parsing.
5. **Typed error handling**: API errors parsed into `ApiClientError` with `status`, `code`, `message`, `details` matching the API's error envelope (`{ success: false, error: { code, message, details? } }`).
6. **Cookie forwarding**: Browser client uses `credentials: "include"`; server client accepts optional `headers` for I-0.2.9 cookie forwarding.
7. **No hardcoded URLs**: All API base URLs come from env vars with `localhost:3001` dev fallback.
8. **204 handling**: Graceful handling of no-content responses.

### Security (OWASP)

- CSRF token auto-attached on browser mutations (A01:2021 Broken Access Control)
- Internal API key only sent on server path, never exposed to browser (A07:2021 Identification & Auth Failures)
- `credentials: "include"` ensures session cookie flows (A07:2021)
- Error bodies sanitized — never leak raw error details to client

### Performance

- No performance targets — this is a thin fetch wrapper. Network latency is dominated by the API response time.

## Design Decisions

| Decision             | Choice                                                                          | Rationale                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| File split           | `api-client.ts` (browser + shared types) + `api-client.server.ts` (server-only) | `.server.ts` convention prevents server code in client bundle. Types/error class shared from `api-client.ts`.       |
| Browser URL env var  | `VITE_API_URL` in `publicEnv`                                                   | Consistent with existing `VITE_*` convention. Accessed via `publicEnv` (never raw `import.meta.env`).               |
| CSRF scope           | Included in I-0.3.6                                                             | CSRF is foundational to "all frontend-API communication" — deferring would leave the client unusable for mutations. |
| Cookie forwarding    | Accept optional `headers` param                                                 | I-0.2.9 will pass forwarded cookies via this param. I-0.3.6 provides the hook, not the implementation.              |
| Error class location | `api-client.ts` (shared)                                                        | Importable by both browser and server code without circular deps.                                                   |

## Implementation Tasks

| #   | Task                                      | File                                         | Action | Complexity | Depends on |
| --- | ----------------------------------------- | -------------------------------------------- | ------ | ---------- | ---------- |
| 1   | Add `VITE_API_URL` to public env schema   | `apps/web/src/lib/env/public.ts`             | modify | S          | —          |
| 2   | Update `.env.example` with `VITE_API_URL` | `apps/web/.env.example`                      | modify | S          | —          |
| 3   | Update `.env.local` with `VITE_API_URL`   | `apps/web/.env.local`                        | modify | S          | —          |
| 4   | Create browser API client + shared types  | `apps/web/src/lib/api-client.ts`             | new    | M          | 1          |
| 5   | Create server API client                  | `apps/web/src/lib/api-client.server.ts`      | new    | M          | 4          |
| 6   | Write browser client tests                | `apps/web/src/lib/api-client.test.ts`        | new    | M          | 4          |
| 7   | Write server client tests                 | `apps/web/src/lib/api-client.server.test.ts` | new    | M          | 5          |
| 8   | Run validation (check-types, lint, test)  | —                                            | verify | S          | 6, 7       |

## API Error Envelope (Reference)

The Fastify API returns errors in this shape (from `apps/api/src/plugins/error-handler.ts`):

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

## Files Summary

| File                                         | Action | Workspace |
| -------------------------------------------- | ------ | --------- |
| `apps/web/src/lib/env/public.ts`             | modify | web       |
| `apps/web/.env.example`                      | modify | web       |
| `apps/web/.env.local`                        | modify | web       |
| `apps/web/src/lib/api-client.ts`             | new    | web       |
| `apps/web/src/lib/api-client.server.ts`      | new    | web       |
| `apps/web/src/lib/api-client.test.ts`        | new    | web       |
| `apps/web/src/lib/api-client.server.test.ts` | new    | web       |

## Testing Plan

### `api-client.test.ts` (browser client, jsdom environment)

- Happy path: GET request returns parsed JSON
- Happy path: POST request sends JSON body + CSRF token
- 204 response returns undefined
- API error (4xx) throws `ApiClientError` with correct fields
- API error with unparseable body throws with fallback message
- CSRF token not attached for GET requests
- CSRF token read from document.cookie

### `api-client.server.test.ts` (node environment)

- Happy path: GET request uses INTERNAL_API_URL
- Internal API key attached when configured
- Internal API key omitted when not configured
- API error throws `ApiClientError`
- Custom headers passed through (foundation for I-0.2.9)
- Falls back to localhost when INTERNAL_API_URL not set
