# EventKart E2E Testing Guide

This document provides comprehensive guidance for running and maintaining the Playwright E2E tests for EventKart.

## Overview

The E2E test suite validates all UI scenarios outlined in `/docs/local-ui-validation-guide.md`, covering:

- **Phase 0**: Foundation, authentication, app shell, observability
- **Module 1.1**: Organizer signup & verification
- **Module 1.2**: Event creation & management
- **Module 2.1**: Event detail page (completed slices)

## Test Structure

```
tests/
├── e2e/                          # E2E test suites
│   ├── auth/                     # Authentication & session tests
│   │   └── login.spec.ts
│   ├── public/                   # Public pages tests
│   │   ├── app-shell.spec.ts
│   │   └── event-detail.spec.ts
│   ├── organizer/                # Organizer workflow tests
│   │   └── profile.spec.ts
│   ├── admin/                    # Admin workflow tests
│   │   └── verification.spec.ts
│   └── events/                   # Event management tests
│       └── event-management.spec.ts
├── fixtures/                     # Test fixtures
│   └── auth.fixture.ts
├── helpers/                      # Helper utilities
│   ├── api-client.ts
│   ├── otp-extractor.ts
│   └── test-users.ts
└── page-objects/                 # Page object models
    ├── auth.page.ts
    ├── public.page.ts
    ├── organizer-profile.page.ts
    ├── admin-verification.page.ts
    └── event.page.ts
```

## Prerequisites

### Required Services

1. **Docker** - For PostgreSQL and Redis
2. **Node.js** - `>=22.12.0` (or `>=20.x` for CI)
3. **pnpm** - `10.33.2`

### Environment Setup

#### 1. Start Infrastructure

```bash
pnpm docker:up
```

#### 2. Configure Environment Variables

**API env** (`apps/api/.env`):

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
INTERNAL_API_KEY=your-local-secret-key
```

**Web env** (`apps/web/.env.local`):

```env
VITE_APP_TITLE=eventKart
VITE_API_URL=http://localhost:3001
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
INTERNAL_API_URL=http://localhost:3001
SERVER_URL=http://localhost:3000
INTERNAL_API_KEY=your-local-secret-key
VITE_SITE_URL=http://localhost:3000
```

**Important**: `INTERNAL_API_KEY` must match in both files.

#### 3. Run Migrations and Seed Data

```bash
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
pnpm --filter @repo/db db:seed
```

#### 4. Start Services

Terminal 1 - API:
```bash
pnpm --filter api dev
```

Terminal 2 - Web:
```bash
pnpm --filter web dev
```

## Running Tests

### Run All Tests

```bash
npx playwright test
```

### Run Specific Test Suite

```bash
# Authentication tests
npx playwright test tests/e2e/auth

# Public pages tests
npx playwright test tests/e2e/public

# Organizer tests
npx playwright test tests/e2e/organizer

# Admin tests
npx playwright test tests/e2e/admin

# Event management tests
npx playwright test tests/e2e/events
```

### Run Single Test File

```bash
npx playwright test tests/e2e/auth/login.spec.ts
```

### Run with UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Run in Headed Mode (See Browser)

```bash
npx playwright test --headed
```

### Run on Specific Browser

```bash
# Desktop Chrome
npx playwright test --project=chromium

# Mobile Chrome
npx playwright test --project=mobile-chrome
```

### Debug Tests

```bash
npx playwright test --debug
```

## Test Data

### Seeded Users

The test suite uses these seeded users (from `docs/local-ui-validation-guide.md`):

| Role        | Phone Number | Full Phone      | Usage                    |
| ----------- | ------------ | --------------- | ------------------------ |
| Admin       | `9999900001` | `+919999900001` | Admin workflow tests     |
| Organizer   | `9999900002` | `+919999900002` | Organizer workflow tests |
| Participant | `9999900003` | `+919999900003` | Participant tests        |

### OTP Authentication

In test mode (`OTP_DELIVERY_MODE=log`), OTP codes are logged to the API console. The test framework uses a mock OTP (`123456`) for automated testing.

## Test Patterns

### Using Page Objects

```typescript
import { test, expect } from "../../fixtures/auth.fixture";
import { TEST_USERS } from "../../helpers/test-users";

test("example test", async ({ page, authPage, publicPage }) => {
  // Navigate using page objects
  await publicPage.navigateToHome();

  // Perform login
  await authPage.login(TEST_USERS.organizer.phone);

  // Assertions
  await expect(page).toHaveURL(/\/org/);
});
```

### Using Auto-Authentication Fixtures

```typescript
test("test with authenticated organizer", async ({
  page,
  authenticatedAsOrganizer,
}) => {
  // Already logged in as organizer
  await page.goto("/org/profile");
  // Continue test...
});
```

### Conditional Tests (Skipped)

Some tests are marked with `test.skip()` because they require:
- Published events in the database
- Storage (S3/R2) configuration
- Specific test data setup

These tests serve as documentation and can be enabled when the prerequisites are met.

## CI/CD Integration

### GitHub Actions

The E2E tests run automatically in CI via `.github/workflows/e2e-tests.yml` on:
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`
- Manual workflow dispatch

### CI Configuration

- Runs on `ubuntu-latest`
- Uses PostgreSQL and Redis services
- Installs Playwright with Chromium
- Runs tests in headless mode
- Uploads test reports and failure videos

### Viewing CI Results

1. Go to GitHub Actions tab
2. Select the workflow run
3. Download artifacts:
   - `playwright-report` - HTML test report
   - `playwright-videos` - Videos of failed tests (if any)

## Test Coverage

### Implemented Scenarios

✅ **Authentication (Section 7.2)**
- OTP login flow
- Session persistence
- Logout functionality
- Role-based access control

✅ **Public App Shell (Section 7.1)**
- Home page loading
- Header and footer rendering
- Theme toggle
- 404 handling
- Protected route redirects

✅ **Public Event Detail (Section 7.17)**
- SSR rendering
- Meta tags and SEO
- Organizer card display
- Policy display
- Pricing breakdown
- Mobile responsiveness

✅ **Organizer Workflows (Sections 7.3-7.6)**
- Profile creation and management
- Policy acceptance
- Verification status tracking
- Document upload readiness

✅ **Admin Workflows (Sections 7.7-7.10)**
- Verification queue
- Filtering and pagination
- Event review queue

✅ **Event Management (Sections 7.11-7.13)**
- Event creation
- Form validation
- Configuration navigation
- Publish readiness

### Skipped/Partial Tests

Some tests are skipped because they require:
1. **Database state** - Specific records (e.g., pending organizers, published events)
2. **Storage configuration** - S3/R2 for document/image uploads
3. **Third-party services** - Razorpay for payment testing
4. **Complex setup** - Multi-step workflows that need test data factory

## Troubleshooting

### Tests Fail with "Locator not found"

**Cause**: UI elements might have different selectors than expected.

**Solution**:
1. Run with `--headed` to see the actual UI
2. Use Playwright Inspector: `npx playwright test --debug`
3. Update selectors in page objects

### Tests Timeout

**Cause**: Services not ready or slow response.

**Solution**:
1. Increase timeout in `playwright.config.ts`
2. Check API and Web servers are running
3. Check database connectivity

### OTP Login Fails

**Cause**: OTP extraction not working.

**Solution**:
1. Verify `OTP_DELIVERY_MODE=log` in API env
2. Check API logs for OTP codes
3. Update OTP extraction pattern in `otp-extractor.ts`

### Session Not Persisting

**Cause**: Cookie issues or auth not properly set.

**Solution**:
1. Check `INTERNAL_API_KEY` matches in both env files
2. Verify `WEB_ORIGIN` is correct in API env
3. Check for CORS issues in browser console

### Database State Issues

**Cause**: Stale or conflicting test data.

**Solution**:
```bash
pnpm docker:reset
pnpm docker:up
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
pnpm --filter @repo/db db:seed
```

## Best Practices

### 1. Use Page Objects

Always use page objects for UI interactions. Don't access elements directly in test files.

❌ **Bad**:
```typescript
await page.locator('input[type="tel"]').fill(phone);
```

✅ **Good**:
```typescript
await authPage.enterPhoneNumber(phone);
```

### 2. Use Auto-Authentication Fixtures

For tests that require authentication, use fixtures instead of repeating login logic.

❌ **Bad**:
```typescript
test("test", async ({ page }) => {
  await page.goto("/org");
  // ... manual login logic ...
});
```

✅ **Good**:
```typescript
test("test", async ({ page, authenticatedAsOrganizer }) => {
  // Already logged in
  await page.goto("/org/profile");
});
```

### 3. Handle Conditional Elements

Some elements might not always be present. Handle gracefully:

```typescript
const hasButton = await button.isVisible().catch(() => false);
if (hasButton) {
  await button.click();
}
```

### 4. Use Appropriate Waits

Don't use arbitrary timeouts. Use proper wait strategies:

❌ **Bad**:
```typescript
await page.waitForTimeout(5000);
```

✅ **Good**:
```typescript
await page.waitForURL(/\/org/, { timeout: 10000 });
await expect(element).toBeVisible({ timeout: 5000 });
```

### 5. Clean Test Data

For tests that create data, consider cleanup:

```typescript
test.afterEach(async ({ page }) => {
  // Cleanup if needed
});
```

## Maintenance

### Adding New Tests

1. Identify the validation scenario from `/docs/local-ui-validation-guide.md`
2. Choose appropriate test suite directory
3. Create or update page objects as needed
4. Write test using fixtures and page objects
5. Run locally to verify
6. Update this documentation

### Updating Page Objects

When UI changes:
1. Update selectors in page objects
2. Run affected tests
3. Commit page object changes separately from test logic changes

### Handling Flaky Tests

1. Identify the flaky test
2. Add better waits or retry logic
3. Consider if test needs test data setup
4. Mark as `test.skip()` with comment if prerequisites are missing

## Performance

- **Average test run time**: ~5-10 minutes for full suite
- **Individual test**: ~5-30 seconds
- **CI run time**: ~15-20 minutes (including setup)

## Known Limitations

1. **Storage-dependent tests** - Skipped without S3/R2 configuration
2. **Razorpay tests** - Skipped without live credentials
3. **Email validation** - Email delivery is stubbed in Phase 1
4. **Real OTP delivery** - Tests use mock OTP in log mode
5. **Published event tests** - Require published events in database

## Future Improvements

1. **Test data factory** - Programmatic test data creation
2. **API test helpers** - Direct API calls for test setup
3. **Visual regression testing** - Screenshot comparison
4. **Accessibility testing** - Automated a11y checks
5. **Performance testing** - Page load metrics
6. **Cross-browser testing** - Firefox and WebKit
7. **Parallel execution** - Faster test runs
8. **Test isolation** - Database transactions per test

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [EventKart Local UI Validation Guide](/docs/local-ui-validation-guide.md)
- [EventKart V1 Implementation Plan](/docs/v1-implementation-plan.md)
- [GitHub Actions Workflow](/.github/workflows/e2e-tests.yml)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test output and logs
3. Run with `--debug` for interactive debugging
4. Open an issue on GitHub
