---
title: EventKart Local UI Validation Guide
date_created: 2026-04-26
scope: Phase 0 through Module 1.1
---

# EventKart Local UI Validation Guide

Use this guide to validate everything completed from the foundation work through **Module 1.1 — Organizer Signup & Verification** before starting Module 1.2.

All commands below use **Bash syntax**. On Windows, run them from Git Bash, WSL, or the VS Code Bash terminal from the repo root.

```bash
cd /c/Users/v-mnmurugan/projects/eventKart
```

## 1. Required local services

You need these installed/running locally:

- Docker Desktop
- Node.js `>=22.12.0`
- pnpm
- PostgreSQL and Redis from this repo's `docker-compose.yml`

Start local infrastructure:

```bash
pnpm docker:up
```

Check containers if needed:

```bash
docker compose ps
```

Reset local infrastructure only if you intentionally want to delete local DB/Redis data:

```bash
pnpm docker:reset
pnpm docker:up
```

## 2. Environment variables

Local env files are package-local:

- API: `apps/api/.env`
- Web: `apps/web/.env.local`

Do not create a root `.env` file.

### API env — `apps/api/.env`

Minimum local values:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3001
LOG_LEVEL=info
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev
REDIS_URL=redis://localhost:6379
OTP_DELIVERY_MODE=log
EMAIL_FROM=EventKart <noreply@eventkart.app>
INTERNAL_API_KEY=replace-with-the-same-local-secret-as-web
```

Important notes:

- Keep `OTP_DELIVERY_MODE=log` for local validation. OTP codes will appear in the API terminal logs.
- Leave `COOKIE_DOMAIN` unset locally. Do not use `.eventkart.app` on localhost.
- `INTERNAL_API_KEY` should be set locally and must match the web env value. This lets web server functions call the API as internal requests and avoids CSRF failures on organizer/admin mutations.

### Web env — `apps/web/.env.local`

Minimum local values:

```env
VITE_APP_TITLE=eventKart
VITE_API_URL=http://localhost:3001
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
INTERNAL_API_URL=http://localhost:3001
SERVER_URL=http://localhost:3000
INTERNAL_API_KEY=replace-with-the-same-local-secret-as-api
```

Important notes:

- `VITE_API_URL` is used by browser-side API calls.
- `INTERNAL_API_URL` is used by TanStack Start server functions.
- `INTERNAL_API_KEY` must match `apps/api/.env`.

## 3. Optional third-party accounts

Basic local validation does not require third-party accounts. For full validation, use the table below.

| Account | Required for local validation? | Needed for |
| --- | --- | --- |
| Cloudflare R2 or AWS S3 | Yes, for full Module 1.1 | Organizer document upload and admin document view URLs |
| MSG91 | No | Real SMS/WhatsApp OTP delivery instead of log mode |
| Resend | No | Real email delivery instead of console/dev logging |
| Razorpay | Optional | Linked-account creation and KYC/payment readiness validation |
| Sentry | No | Error tracking validation |
| PostHog | No | Product analytics validation |

### Object storage env for document upload

To validate document upload from the UI, configure S3-compatible storage in `apps/api/.env`:

```env
S3_ENDPOINT=https://your-storage-endpoint
S3_REGION=auto
S3_ACCESS_KEY_ID=replace-me
S3_SECRET_ACCESS_KEY=replace-me
S3_BUCKET=eventkart-dev
S3_FORCE_PATH_STYLE=true
```

For Cloudflare R2, configure bucket CORS to allow local browser uploads:

- Origin: `http://localhost:3000`
- Methods: `PUT`, `GET`, `HEAD`
- Allowed headers: `Content-Type`, `x-amz-server-side-encryption`
- Exposed headers: `ETag`

Without these storage variables, document upload and admin document viewing are expected to be unavailable.

### MSG91 env for real OTP delivery

Only use this if you want real OTP messages instead of terminal log mode:

```env
OTP_DELIVERY_MODE=msg91
MSG91_AUTH_KEY=replace-me
MSG91_OTP_TEMPLATE_ID=replace-me
```

### Resend env for real email delivery

```env
RESEND_API_KEY=replace-me
EMAIL_FROM=EventKart <noreply@yourdomain.com>
```

### Razorpay env for linked-account validation

```env
RAZORPAY_KEY_ID=rzp_test_replace-me
RAZORPAY_KEY_SECRET=replace-me
```

Note: Admin approval enqueues Razorpay linked-account creation. Before considering Razorpay sync fully validated, confirm the Razorpay account worker is actually wired into the local worker process.

## 4. Install dependencies

If dependencies are not installed:

```bash
pnpm install
```

## 5. Migrate and seed the database

The DB package requires `DATABASE_URL` in the shell environment when running Drizzle commands. The DB package does not automatically load `apps/api/.env`.

Run migrations:

```bash
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
```

Seed development users:

```bash
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:seed
```

Seeded login users:

| Role | Phone to enter in UI | Stored phone |
| --- | ---: | --- |
| Admin | `9999900001` | `+919999900001` |
| Organizer | `9999900002` | `+919999900002` |
| Participant | `9999900003` | `+919999900003` |

In the UI, enter only the 10-digit number. The UI prepends `+91` automatically.

## 6. Start the apps

Use separate terminals.

Terminal 1 — local infrastructure:

```bash
pnpm docker:up
```

Terminal 2 — API:

```bash
pnpm --filter api dev
```

Terminal 3 — web:

```bash
pnpm --filter web dev
```

Optional Terminal 4 — workers:

```bash
pnpm --filter api start:worker
```

Open the app:

```text
http://localhost:3000
```

Check health endpoints:

```text
http://localhost:3001/health
http://localhost:3001/ready
http://localhost:3000/health
http://localhost:3000/ready
```

## 7. UI validation checklist

### 7.1 Public app shell

Validate:

- Home page loads at `/`.
- Header, footer, and mobile bottom navigation render correctly.
- Theme toggle works.
- Unknown routes show the 404 UI.
- Protected routes redirect unauthenticated users.

Try these routes while logged out:

```text
/org
/admin
/my
```

Expected result:

- User is redirected to `/`.
- A toast/message indicates authentication is required or access is forbidden.

### 7.2 OTP login and session

Use the seeded users.

Organizer login:

```text
9999900002
```

Steps:

1. Open a protected route like `/org`.
2. Enter the phone number.
3. Click send OTP.
4. Read the OTP from the API terminal logs.
5. Enter the OTP in the UI.
6. Confirm that the session is created.
7. Refresh the page and confirm the user stays logged in.
8. Logout and confirm the session is cleared.

Role routing checks:

| Phone | Expected access |
| --- | --- |
| `9999900001` | Can access `/admin` |
| `9999900002` | Can access `/org` |
| `9999900003` | Can access `/my`; should be blocked from `/org` and `/admin` |

### 7.3 Organizer registration and profile management

Login as organizer:

```text
9999900002
```

Go to:

```text
/org
```

If no organizer profile exists:

1. Click **Create Organizer Profile**.
2. Fill the organizer registration form.
3. Submit the form.

Validate:

- Required field validation works.
- Email and phone validation works.
- Profile creation succeeds.
- `/org/profile` loads existing data.
- Editing profile persists after refresh.
- Only changed fields are submitted where applicable.

### 7.4 Policy acceptance

Go to:

```text
/org/policies
```

Validate:

- Required policy checkboxes are not pre-checked.
- Required policies must be selected before successful submission.
- Optional/marketing consent is separate if displayed.
- Submission succeeds.
- Returning to `/org` no longer blocks the dashboard because of policy status.
- Refresh keeps policy acceptance state.

### 7.5 Verification status tracking

Go to:

```text
/org/verification
```

Validate:

- Initial status is usually `pending_documents`.
- Document checklist is visible.
- Policy acceptance status is reflected.
- Progress updates as documents are uploaded.
- SLA/review information appears when status becomes `pending_review`.

### 7.6 Verification document upload

This requires S3/R2 environment variables.

Go to:

```text
/org/verification
```

Upload the required document types:

- Aadhaar
- PAN
- GST certificate
- Bank proof

Validate:

- PDF, JPEG, and PNG files are accepted.
- Invalid types or oversized files are rejected.
- The UI requests a presigned upload URL.
- The browser uploads directly to object storage.
- Confirming upload marks the document as uploaded.
- The checklist count increments.
- Deleting/replacing documents updates status.
- After all required documents and required policies are complete, organizer status becomes `pending_review`.

Expected result without storage env vars:

- Document upload is unavailable. This is expected, not a UI bug.

### 7.7 Admin verification queue

Login as admin:

```text
9999900001
```

Go to:

```text
/admin/verifications
```

Validate:

- Verification queue loads.
- Pagination UI loads.
- Status filtering works.
- Organizers in `pending_review` appear.
- Detail page opens for each organizer.

### 7.8 Admin verification detail

From the admin queue, open an organizer detail page.

Validate:

- Organizer business information is displayed.
- Document list is displayed.
- Policy status is displayed.
- SLA/review metadata is displayed.
- Document view URL works when storage is configured.
- Without storage env vars, document viewing shows the expected unavailable state/error.

### 7.9 Admin approve/reject

For an organizer in `pending_review`, validate both paths.

Approve path:

1. Click approve.
2. Add optional notes if the UI shows a notes field.
3. Submit.
4. Confirm organizer status becomes `approved`.
5. Confirm verification badge appears where available.
6. Confirm Razorpay account status starts as `not_started` if Razorpay is not fully processed.

Reject path:

1. Use another organizer or reset local DB.
2. Click reject.
3. Confirm rejection reason is required.
4. Submit.
5. Confirm organizer status becomes `rejected`.
6. Confirm rejection reason appears on the organizer verification page.

### 7.10 Razorpay linked-account sync

Only validate this if Razorpay test credentials are configured and worker wiring is confirmed.

Expected flow:

1. Admin approves organizer.
2. API enqueues Razorpay linked-account creation.
3. Worker processes the job.
4. Organizer `razorpayAccountStatus` transitions from `not_started` to one of `pending`, `active`, `needs_action`, or `failed`.
5. Admin retry works for retryable statuses.

## 8. Automated checks

Run these before or after manual UI validation.

Full checks:

```bash
pnpm lint
pnpm test
pnpm check-types
```

Targeted checks:

```bash
pnpm --filter api test
pnpm --filter web test
pnpm --filter @repo/db test
```

Focused API suites:

```bash
pnpm --filter api exec vitest run test/modules/auth
pnpm --filter api exec vitest run test/modules/organizer
pnpm --filter api exec vitest run test/modules/admin
pnpm --filter api exec vitest run test/modules/payment/razorpay-account.test.ts
pnpm --filter api exec vitest run test/plugins
pnpm --filter api exec vitest run test/routes
```

Focused web suite:

```bash
pnpm --filter web test
```

Database validation checks:

```bash
pnpm --filter @repo/db db:check:lock-risk
pnpm --filter @repo/db db:check:rollbacks
```

## 9. Troubleshooting

### Migration command fails with `DATABASE_URL is required`

Run the migration from a Bash shell with `DATABASE_URL` exported in the same terminal:

```bash
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
```

### OTP verify fails with invalid origin

Check API env:

```env
WEB_ORIGIN=http://localhost:3000
```

Then restart the API server.

### Organizer/admin form submission fails with CSRF error

Ensure both env files have the same internal key:

```env
INTERNAL_API_KEY=replace-with-the-same-local-secret
```

Restart both API and web servers after changing env files.

### Document upload is unavailable

Configure S3/R2 env vars in `apps/api/.env`, restart the API, and confirm the bucket CORS allows `http://localhost:3000`.

### Role access looks wrong after login

Use seeded phones and log in again:

```text
Admin: 9999900001
Organizer: 9999900002
Participant: 9999900003
```

If data is stale, reset and reseed local DB:

```bash
pnpm docker:reset
pnpm docker:up
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
pnpm --filter @repo/db db:seed
```

## 10. Minimum pass criteria before Module 1.2

Before starting Module 1.2, confirm:

- Auth and logout work from UI.
- Role redirects work for participant, organizer, and admin.
- Organizer can create and update profile.
- Organizer can accept required policies.
- Verification status page reflects policy/document progress.
- With storage configured, organizer can upload all required documents.
- Completed organizer verification reaches `pending_review`.
- Admin can view queue and detail pages.
- Admin can approve or reject pending organizers.
- Automated API/web tests for auth, organizer, admin, and plugins pass.
