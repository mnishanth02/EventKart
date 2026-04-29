# E2E Testing with Playwright

Quick reference guide for EventKart end-to-end testing.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start services
pnpm docker:up

# Setup database
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
pnpm --filter @repo/db db:seed

# Start API (terminal 1)
pnpm --filter api dev

# Start Web (terminal 2)
pnpm --filter web dev

# Run tests (terminal 3)
pnpm test:e2e
```

## Commands

```bash
pnpm test:e2e          # Run all E2E tests
pnpm test:e2e:ui       # Interactive UI mode
pnpm test:e2e:headed   # With visible browser
pnpm test:e2e:debug    # Debug mode
pnpm test:e2e:report   # View last HTML report
```

## Test Structure

```
tests/
├── e2e/              # Test suites
├── fixtures/         # Reusable fixtures
├── helpers/          # Utilities
└── page-objects/     # Page Object Models
```

## Documentation

- **Full Guide**: `/docs/e2e-testing-guide.md`
- **Findings Report**: `/docs/e2e-implementation-findings.md`
- **Validation Guide**: `/docs/local-ui-validation-guide.md`

## Test Coverage

✅ **Automated**:
- Authentication & session management
- Public app shell (navigation, theme, 404)
- Organizer workflows (profile, policies, verification)
- Admin workflows (verification queue, approve/reject)
- Event management (creation, configuration)
- Public event detail pages

⚠️ **Conditional/Skipped**:
- Storage-dependent tests (document/image upload)
- Razorpay integration tests
- Tests requiring specific database state

## CI/CD

Tests run automatically in GitHub Actions:
- On PRs to main/develop
- On push to main/develop
- Manual workflow dispatch

See `.github/workflows/e2e-tests.yml` for details.

## Troubleshooting

**Tests timeout?**
- Increase timeout in `playwright.config.ts`
- Check API/Web servers are running
- Check database is migrated and seeded

**OTP login fails?**
- Verify `OTP_DELIVERY_MODE=log` in `apps/api/.env`
- Check API logs for OTP codes

**Session not persisting?**
- Check `INTERNAL_API_KEY` matches in both `.env` files
- Verify `WEB_ORIGIN=http://localhost:3000` in API env

## Support

For detailed help, see `/docs/e2e-testing-guide.md`.
