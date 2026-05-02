# Bugfix: Create-Event Gate + Drop Coimbatore-Only City Lock

**Type:** Bug fix + Phase 2 schema descope
**Status:** 📋 Planned
**Started:** 2026-05-02
**Dependencies:** I-1.1.1 (organizer registration), I-1.1.3 (policy acceptance),
I-1.2.1 (event creation form), W1.1 (organizers slug — already shipped)
**Related:** No new API endpoints or response shapes; create-event behaviour
tightens policy enforcement and the event schema becomes more permissive for
city/state.

## Background

Two unrelated user-reported issues are bundled here because they were filed
together. Splitting into two PRs is fine but the file plans them as one
slice for shared verification.

### Issue 1 — `/org/events/new` doesn't gate on profile / policies

The organizer dashboard at `/org` shows a "Complete Your Profile" card that
links to `/org/register` whenever the signed-in organizer has no
`organizers` row, and a "Accept Platform Policies" card whenever the row
exists but `consent_records` is missing the current versions. The
sibling routes `/org/profile`, `/org/policies`, and `/org/verification`
all run through similar gates (verified in the screenshot: "Complete Your
Profile — You need to create an organizer profile before you can manage
events.").

The `/org/events/new` route at
[apps/web/src/routes/_authed/org/events/new.tsx](../../apps/web/src/routes/_authed/org/events/new.tsx)
is missing this gate entirely. A brand-new organizer can land on the
event-creation form, fill it in, and submit; the API then rejects the request
because `createDraftEvent()` cannot find an organizer profile. The UX is broken
— the form should never have rendered.

### Issue 2 — "Coimbatore" is hardcoded as a system restriction

The Create Event page surfaces a "V1 event constraints" panel labelled
**"Location: Coimbatore, Tamil Nadu, India"** and the City field is a
disabled, read-only `<Input value="Coimbatore, Tamil Nadu" />`. Behind
that UI, four PostgreSQL `CHECK` constraints + four `z.literal()` Zod
locks reject any `city` other than "Coimbatore", any `state` other than
"Tamil Nadu", any `country` other than "India", and any `timezone` other
than "Asia/Kolkata".

Coimbatore is the launch wedge per `docs/product-plan.md` §3 ("**City:**
Coimbatore") and `docs/requirements.md` §1 ("**Launch wedge:**
Coimbatore-only"). But the wedge is **product positioning, not a system
restriction** — onboarding an organizer in Chennai or Madurai during the
Tamil Nadu pilot expansion shouldn't require a code change. The user's
clarification was explicit: "We will not restrict anyone like organiser
could be from anyone, anywhere."

### User clarifications (from `vscode_askQuestions`)

- **`coimbatore-scope`:** Option B — **Allow any Indian city, keep IST timezone**.
  - Drop the city + state DB CHECKs and Zod literal locks.
  - Keep `country = 'India'` (V1 stays India-only).
  - Keep `timezone = 'Asia/Kolkata'` (V1 stays IST-only — propagates into
    too many helpers to relax safely in this slice).
  - Keep `is_paid = true` (orthogonal to location; user did not ask).
- **`gate-create-event`:** Yes — match the dashboard gate exactly
  (profile + policies + loading + error). Sidebar nav stays visible
  (matches today's UX where the gate fires on click).

## Out of scope

1. **Public marketing copy that mentions Coimbatore stays.** The hero
   badge "Coimbatore's Running Community" on `/`, the
   `/about` Coimbatore-pilot story, the `docs/product-plan.md` /
   `docs/requirements.md` / `docs/design-system*.md` narrative, and the
   organizer-registration form's "Coimbatore" placeholder are all
   describing positioning, not data restrictions. **No edits.**
2. **`country = 'India'` literal lock stays.** Relaxing it bundles
   unrelated scope (currency, tax, compliance) and the user said "any
   Indian city".
3. **`timezone = 'Asia/Kolkata'` literal lock stays.** Removing it would
   ripple through `getCoimbatoreDateKey` (renamed in Phase 2c), the
   single-day rule in `validateEventSchedule`, the `isoToCoimbatoreDateTimeLocal`
   datetime conversion in the form, and the cached SSR date renderers on
   the public detail page. Out of scope.
4. **`is_paid = true` literal lock stays.** Free events bring an unbuilt
   parallel path (no payout flow, different refund rules).
5. **Sidebar nav hiding.** User explicitly chose "Sidebar stays visible".
   Gate fires on click, matching today's behaviour for sibling routes.

## Phase 1 — Gate `/org/events/new` like the dashboard

Behaviour-preserving refactor: extract the inline gate from
[apps/web/src/routes/_authed/org/index.tsx](../../apps/web/src/routes/_authed/org/index.tsx)
into a reusable component, then wrap the create-event page in it.

### P1.1 — Extract `<OrganizerSetupGate>`

**File:** `apps/web/src/features/organizer/components/organizer-setup-gate.tsx`
*(new)*

Move the dashboard gating logic (lines 139–253 of `org/index.tsx`) into a new
component:

```tsx
type Props = { children: ReactNode; headingLevel?: 1 | 2 };

export function OrganizerSetupGate({ children, headingLevel = 1 }: Props) {
  const profileQuery = useQuery(organizerProfileQueryOptions());
  const policyQuery = useQuery({
    ...policyStatusQueryOptions(),
    enabled: profileQuery.data != null,
  });

  if (profileQuery.isLoading) return <LoadingProfile />;
  if (profileQuery.isError) return <ProfileLoadErrorCard onRetry={() => profileQuery.refetch()} />;
  if (!profileQuery.data) return <CompleteProfileCta />;

  if (policyQuery.isLoading) return <CheckingPolicies />;
  if (policyQuery.isError) return <PolicyLoadErrorCard onRetry={() => policyQuery.refetch()} />;
  if (policyQuery.data?.allRequiredAccepted !== true) {
    return <AcceptPoliciesCta />;
  }

  return <>{children}</>;
}
```

The six sub-components (`LoadingProfile`, `ProfileLoadErrorCard`,
`CompleteProfileCta`, `CheckingPolicies`, `PolicyLoadErrorCard`,
`AcceptPoliciesCta`) are colocated in the same file as private
helpers — they wrap `<Card>` / `<CardHeader>` / `<CardContent>` exactly
as the dashboard does today. Copy and `Link to=` targets stay
**byte-identical** to the dashboard so existing screenshots match. The
optional `headingLevel` only changes `aria-level`: the dashboard keeps level 1,
while routes that already render an outer `<h1>` pass level 2 to avoid duplicate
screen-reader level-1 headings.

### P1.2 — Refactor the dashboard route to use the gate

**File:** [apps/web/src/routes/_authed/org/index.tsx](../../apps/web/src/routes/_authed/org/index.tsx)

Split `OrganizerDashboard()` into:

- `OrganizerDashboard()` (route component) — renders
  `<OrganizerSetupGate><OrganizerDashboardContent /></OrganizerSetupGate>`
- `OrganizerDashboardContent()` *(new, in same file)* — the body that
  starts at the existing line 254 ("Welcome back, …", `<VerificationStatusCard />`,
  the three action buttons).

The dashboard's early-return blocks are deleted from this file (they live in
the gate now).

### P1.3 — Wrap `EventCreateForm` in the gate

**File:** [apps/web/src/routes/_authed/org/events/new.tsx](../../apps/web/src/routes/_authed/org/events/new.tsx)

Before:

```tsx
function NewEventPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Event</h1>
        <p className="text-muted-foreground">
          Create a V1 paid single-day running event in Coimbatore.
        </p>
      </div>
      <EventCreateForm />
    </div>
  );
}
```

After:

```tsx
function NewEventPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Event</h1>
        <p className="text-muted-foreground">
          Create a V1 paid single-day running event.
        </p>
      </div>
      <OrganizerSetupGate headingLevel={2}>
        <EventCreateForm />
      </OrganizerSetupGate>
    </div>
  );
}
```

Two edits in one pass:

1. Wrap `<EventCreateForm />` in `<OrganizerSetupGate>` (Issue 1 fix).
2. Remove "in Coimbatore" from the subtitle (Issue 2 copy fix).

The page heading + subtitle stay **outside** the gate so the route always
has an `<h1>` and screen-reader landmarks even when the gate is showing
the CTA card.

### P1.4 — Tests

**File:** `apps/web/src/features/organizer/components/organizer-setup-gate.test.tsx`
*(new)*

Seven test cases using the React Query test harness pattern already in use
across `apps/web` (`QueryClientProvider` + `vi.mock(...)` for
`organizerProfileQueryOptions` and `policyStatusQueryOptions`):

1. `isLoading` → renders "Loading profile..."
2. profile query errors → renders "Something Went Wrong" with Retry button
3. profile query returns `null` (and defensively `undefined`) → renders
  "Complete Your Profile" card with `Link to="/org/register"`
4. profile exists, policy `isLoading` → renders "Checking policy status..."
5. profile exists, policy errors → renders "Something Went Wrong" with Retry
6. profile exists, policies `allRequiredAccepted: false` → renders
   "Accept Platform Policies" card with `Link to="/org/policies"`
7. profile exists, policies `allRequiredAccepted: true` → renders
   `children` pass-through

The CTA tests should assert the actual rendered `href` / mocked `to` value for
`/org/register` and `/org/policies`, not just the visible button text.

**File:** `apps/web/src/routes/_authed/org/events/new.test.tsx` *(new)*

Three route-view tests. Export `NewEventPage` from the route file so the test
can render it directly with a `QueryClientProvider` and mocked router `Link`
/ `useNavigate`, matching the existing route-test style that avoids mounting a
full generated route tree:

1. Profile + policies pass → renders the `EventCreateForm` (assert by
   presence of "Create running event" `CardTitle`).
2. No profile → renders "Complete Your Profile" CTA.
3. Policies missing → renders "Accept Platform Policies" CTA.

The existing dashboard's behavioural surface (welcome, verification card,
three action buttons) doesn't have a test today; we deliberately do not
add one in this slice.

### P1.5 — Backend policy enforcement for create-event

**File:** [apps/api/src/modules/events/service.ts](../../apps/api/src/modules/events/service.ts)

The UI gate alone is not sufficient: today `createDraftEvent()` only checks that
an organizer profile exists. A profile-bearing organizer who has not accepted
the current policies can still create an event by calling the API directly.
Add a service-level check after `getOrganizerByUserId(...)` succeeds and before
slug generation/insert:

- import `hasAcceptedAllPolicies` from `../organizer/policy-service.js`.
- if `await hasAcceptedAllPolicies(db, userId)` is false, throw
  `ForbiddenError("Organizer policies must be accepted before creating events")`.
- no new endpoint or response shape is introduced; the existing `403` response
  schema on `POST /api/v1/events` handles the error.

**Tests:** update `apps/api/test/modules/events/service.test.ts` and
`apps/api/test/modules/events/routes.test.ts`:

- `createDraftEvent` rejects before slug generation/insert when policies are not
  accepted.
- route maps that service `ForbiddenError` to `403`.
- happy-path mocks include the extra consent-record select required by
  `hasAcceptedAllPolicies`.

### P1 verification

```sh
pnpm --filter web exec vitest run src/features/organizer/components/organizer-setup-gate.test.tsx
pnpm --filter web exec vitest run src/routes/_authed/org/events/new.test.tsx
pnpm --filter api exec vitest run test/modules/events/service.test.ts test/modules/events/routes.test.ts
pnpm --filter web test          # full suite — must stay green after refactor
pnpm --filter api test          # full suite — catches service/mock regressions
pnpm --filter web check-types
pnpm --filter api check-types
pnpm --filter web lint
```

Manual: log in as a freshly OTP-verified user with no organizer profile
→ navigate to `/org/events/new` → sees "Complete Your Profile" card →
clicks button → arrives at `/org/register` → completes profile → accepts
policies → returns to `/org/events/new` → sees the form.

---

## Phase 2 — Drop Coimbatore-only city + state restrictions

Three sub-phases in dependency order: DB schema (P2a) → shared Zod (P2b)
→ web form + helper renames (P2c) → tests + docs (P2d).

### P2a — Database CHECK constraints

**File:** [packages/db/src/schema/events.ts](../../packages/db/src/schema/events.ts)
(lines 122–132)

Remove the `city` and `state` `check(...)` calls from the table builder's
check array. **Keep** `events_v1_country_check`,
`events_v1_timezone_check`, `events_v1_paid_check`,
`events_form_schema_version_check`. Keep the `.default(V1_EVENT_CITY)`
and `.default(V1_EVENT_STATE)` column defaults — they become prefill
values, not locks.

```diff
- check("events_v1_city_check", sql.raw(`"city" = '${V1_EVENT_CITY}'`)),
- check("events_v1_state_check", sql.raw(`"state" = '${V1_EVENT_STATE}'`)),
  check(
    "events_v1_country_check",
    sql.raw(`"country" = '${V1_EVENT_COUNTRY}'`),
  ),
  check(
    "events_v1_timezone_check",
    sql.raw(`"timezone" = '${V1_EVENT_TIMEZONE}'`),
  ),
  check("events_v1_paid_check", sql.raw('"is_paid" = true')),
```

**Migration generation:**

```sh
pnpm --filter @repo/db db:generate
```

This should produce the next migration file under `packages/db/drizzle/`
(currently expected to be `0019_*.sql` if no concurrent migration lands first;
Drizzle picks the suffix). Expected contents:

```sql
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_v1_city_check";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_v1_state_check";
```

**Manually create the rollback file:**
`packages/db/drizzle/rollbacks/0019_<same-suffix>.rollback.sql`:

```sql
-- Rollback for 0019_<suffix>.sql (drop city + state V1 CHECKs)
ALTER TABLE "events" ADD CONSTRAINT "events_v1_city_check" CHECK ("city" = 'Coimbatore');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_v1_state_check" CHECK ("state" = 'Tamil Nadu');
```

(Mirrors the original additions in
[`0008_ambitious_raza.sql`](../../packages/db/drizzle/0008_ambitious_raza.sql) lines 30–31.)

**No data migration required.** Existing rows already satisfy the
relaxed constraint (every event in production today has
`city = 'Coimbatore'` because of the dropped CHECK).

**Adversarial-review note:** if Drizzle's generator emits anything
besides the two `DROP CONSTRAINT` statements (e.g., it tries to recreate
the entire table because of `sql.raw` parsing quirks), **stop and
hand-write the migration** with the exact two lines above. Before touching
`packages/db/drizzle/meta/_journal.json` or snapshots manually, inspect the
current migration metadata and keep it consistent with the existing repo
practice; do not add a one-off journal entry that skips prior SQL files. The
schema diff for two CHECK drops should be trivial; if Drizzle disagrees,
prefer explicit SQL over a generator-driven full-table rebuild.

### P2b — Shared Zod schemas

**File:** [packages/shared/src/schemas/event.ts](../../packages/shared/src/schemas/event.ts)
(lines 113–139)

Replace `city` and `state` `z.literal()` locks with bounded free-text
strings, identical bounds to `organizerRegistrationSchema.city`:

```diff
  city: z
-   .literal(V1_EVENT_CITY, {
-     message: "V1 event creation is limited to Coimbatore",
-   })
+   .string()
+   .trim()
+   .min(2, "City must be at least 2 characters")
+   .max(100, "City must not exceed 100 characters")
    .default(V1_EVENT_CITY),
  state: z
-   .literal(V1_EVENT_STATE, {
-     message: "V1 event creation is limited to Tamil Nadu",
-   })
+   .string()
+   .trim()
+   .min(2, "State must be at least 2 characters")
+   .max(100, "State must not exceed 100 characters")
    .default(V1_EVENT_STATE),
```

**Keep unchanged:**

- `country: z.literal(V1_EVENT_COUNTRY, ...).default(V1_EVENT_COUNTRY)` — V1 stays India-only.
- `timezone: z.literal(V1_EVENT_TIMEZONE, ...).default(V1_EVENT_TIMEZONE)` — IST stays.
- `isPaid: z.literal(V1_EVENT_IS_PAID, ...).default(V1_EVENT_IS_PAID)` — paid-only stays.

**Helper rename (clarity only, no logic change):**

- `getCoimbatoreDateKey(value)` → `getEventDateKeyInIst(value)`
- `coimbatoreDateFormatter` (private) → `istDateFormatter`

The helper has always been timezone-IST based (it formats with
`timeZone: V1_EVENT_TIMEZONE`); the rename prevents a future agent from
assuming the helper is city-aware. Update the in-error-message reference
in `validateEventSchedule` to use plain phrasing — the existing message
"V1 events must start and end on the same day" needs no edit.

**Constants left alone:** `V1_EVENT_CITY`, `V1_EVENT_STATE`,
`V1_EVENT_ALLOWED_VALUES` in
[packages/shared/src/constants/event.ts](../../packages/shared/src/constants/event.ts)
remain as-is. They're now used as defaults rather than literal-lock
targets, which is a graceful deprecation path: a follow-up slice can
remove `V1_EVENT_CITY` and `V1_EVENT_STATE` from
`V1_EVENT_ALLOWED_VALUES` once nothing reads them as locks. No
behavioural change in this slice.

### P2c — Web form + helper renames

**File:** [apps/web/src/features/events/form-values.ts](../../apps/web/src/features/events/form-values.ts)

Two helper renames (logic unchanged — both are constant `+05:30` IST offset):

- `coimbatoreDateTimeLocalToIso` → `istDateTimeLocalToIso`
- `isoToCoimbatoreDateTimeLocal` → `isoToIstDateTimeLocal`

`getDefaultCreateEventValues()` keeps prefilling
`city: V1_EVENT_CITY, state: V1_EVENT_STATE` — the constants are still
the smart Coimbatore-pilot defaults. **No behavioural change to the
default form payload.**

**File:** `apps/web/src/features/events/form-values.test.ts`

Update the helper imports and test names from Coimbatore-local wording to
IST-local wording. Keep the expected conversions unchanged (`+05:30`).

**File:** [apps/web/src/features/events/components/event-create-form.tsx](../../apps/web/src/features/events/components/event-create-form.tsx)

Edits in this file (cumulative diff is medium — ~30 lines):

1. Update imports: `isoToCoimbatoreDateTimeLocal` → `isoToIstDateTimeLocal`,
   `coimbatoreDateTimeLocalToIso` → `istDateTimeLocalToIso`.

2. Rewrite `<V1ConstraintSummary />` (lines 64–94). The "Location" row
   becomes:

   ```tsx
   { label: "Country", value: V1_EVENT_COUNTRY },
   ```

   Drop the `V1_EVENT_CITY` / `V1_EVENT_STATE` interpolation. Add a
   single muted line below the badge grid: "Hosted in your chosen Indian
   city — currently piloting in Coimbatore." Keep the other rows: Event
   type, Category, Pricing, Schedule (single-day), Timezone (Asia/Kolkata).

3. Replace the disabled location `<Input>` (around line 270) with
   **two real form fields** for city + state:

   ```tsx
   <form.Field name="city">
     {(field) => (
       <div className="space-y-2">
         <Label htmlFor={field.name}>
           City <RequiredMark />
         </Label>
         <Input
           id={field.name}
           name={field.name}
           value={field.state.value}
           placeholder="Coimbatore"
           aria-describedby={`${field.name}-error`}
           aria-invalid={field.state.meta.errors.length > 0}
           aria-required="true"
           onBlur={field.handleBlur}
           onChange={(e) => field.handleChange(e.target.value)}
         />
         {field.state.meta.isTouched && (
           <FormFieldError
             id={`${field.name}-error`}
             errors={field.state.meta.errors}
           />
         )}
       </div>
     )}
   </form.Field>
   ```

   And an analogous `<form.Field name="state">` next to it (placeholder
   "Tamil Nadu"). The two fields share the existing `md:grid-cols-2`
   row that previously held `venueName` + the disabled location input —
   so the layout becomes a 3-row grid: Venue / City / State (refactor
   to a `md:grid-cols-3` row, or split into two `md:grid-cols-2` rows
   keeping Venue solo on its row — pick whichever the eyeballs say
   looks right).

4. Drop "in Coimbatore" from the `<CardDescription>` on line 158:
   "Create a draft paid running event in Coimbatore. You can publish it
   after review once ticketing details are configured." →
   "Create a draft paid running event. You can publish it after review
   once ticketing details are configured."

5. Update the two `datetime-local` help texts:
   - "Select the Coimbatore local date and start time." → "Select the
     event local date and start time (IST)."
   - "Must be after start and on the same Coimbatore day." → "Must be
     after start and on the same calendar day (IST)."

6. Extend `hasRequiredCreateEventValues(values)` to also require
   `city` and `state` (matches the **`forms` repo memory**: "gate
   submit with explicit required-value checks in addition to
   state.canSubmit"):

   ```diff
     return (
       values.title.trim().length > 0 &&
       values.description.trim().length > 0 &&
       values.venueName.trim().length > 0 &&
       values.addressLine1.trim().length > 0 &&
   +   values.city.trim().length > 0 &&
   +   values.state.trim().length > 0 &&
       values.startAt.trim().length > 0 &&
       values.endAt.trim().length > 0 &&
       values.routeDetails.trim().length > 0
     );
   ```

**File:** [apps/web/src/features/events/components/event-edit-form.tsx](../../apps/web/src/features/events/components/event-edit-form.tsx)

Helper-rename imports and date-help copy:

- `isoToCoimbatoreDateTimeLocal` → `isoToIstDateTimeLocal`
- `coimbatoreDateTimeLocalToIso` → `istDateTimeLocalToIso`
- "Select the Coimbatore local date and start time." → "Select the event
  local date and start time (IST)."
- "Must be after start and on the same Coimbatore day." → "Must be after start
  and on the same calendar day (IST)."

The edit form already shows `event.city / event.state / event.country`
from the saved record (in `<ImmutableEventSummary>`), so it continues
displaying the actual stored values. City/state remain immutable after draft
creation in this slice; making location editable later would be a separate API
surface change.

### P2d — Tests + docs

**Test edits:**

- **`packages/shared/test/schemas/event.test.ts`** — invert the
  "rejects non-Coimbatore events" case at line 37:

   ```diff
   - it("rejects non-Coimbatore events", () => {
   -   const result = createEventInputSchema.safeParse({
   -     ...validEvent,
   -     city: "Chennai",
   -   });
   -   expect(result.success).toBe(false);
   -   expect(...).toContain("V1 event creation is limited to Coimbatore");
   - });
   + it("accepts events in any Indian city", () => {
   +   const result = createEventInputSchema.safeParse({
   +     ...validEvent,
   +     city: "Chennai",
   +     state: "Tamil Nadu",
   +   });
   +   expect(result.success).toBe(true);
   +   if (result.success) {
   +     expect(result.data.city).toBe("Chennai");
   +   }
   + });
   ```

  Add six new cases:

  - "rejects city shorter than 2 chars" → city `"A"` → `success: false`.
  - "rejects city longer than 100 chars" → city of length 101 → `success: false`.
  - "rejects blank city after trimming" → city `"   "` → `success: false`.
  - "rejects blank state after trimming" → state `"   "` → `success: false`.
  - "still rejects non-India country" → `country: "Bhutan"` → `success: false`,
    message contains "limited to India".
  - "still rejects non-IST timezone" → `timezone: "America/New_York"` →
    `success: false`, message contains "Asia/Kolkata".

- **`apps/api/test/modules/events/service.test.ts`** — update the
  create-event service tests:

  - Remove `city: "Chennai"` from the `rejects invalid V1 ... constraints`
    table.
  - Add a happy-path case proving `createDraftEvent` accepts and inserts
    `city: "Chennai", state: "Tamil Nadu"` once policy acceptance passes.
  - Add the P1.5 policy-enforcement failure case.

- **`apps/api/test/modules/events/routes.test.ts`** — update route tests:

  - Remove `city: "Chennai"` from the route-level invalid V1 constraints
    table because request validation should now allow it.
  - Add/adjust a route case proving a Chennai payload reaches
    `createDraftEvent`.
  - Add the P1.5 `ForbiddenError` → `403` mapping case.

- **`apps/api/test/modules/events/**` sweep** — search for any literal
  assertions on `city: "Coimbatore"` or `state: "Tamil Nadu"` that
  would break:

   ```sh
   grep -rn 'city.*Coimbatore\|state.*Tamil Nadu' apps/api/test/modules/events/
   ```

   Expected result: zero blocking matches. The matches in
   `event-image-service.test.ts` and `public-detail.test.ts` are
   **fixture data** (the test creates an organizer "in Coimbatore" and
   asserts that the response contains the same city back). They keep
   working because (a) Coimbatore is still a valid city and (b) the
   response shape is unchanged. Run `pnpm --filter api test` to confirm.

- **`apps/web/src/features/events/components/event-create-form.test.tsx`** *(new)*

  No test exists today (`file_search` returned empty). Add a small
  colocated test using the existing TanStack Form / mocked-mutation
  pattern:

  - Renders city + state inputs prefilled to "Coimbatore" / "Tamil Nadu".
  - Fill all other required fields with a minimal valid payload, clear the city,
    type "Chennai", submit → mocked `createEvent` is called with
    `city: "Chennai"`.
  - Fill all other required fields first, then clear the city and assert the
    submit button becomes `disabled` (isolates the new
    `hasRequiredCreateEventValues` branch instead of passing because the whole
    form is still empty).

- **`apps/web/src/features/events/form-values.test.ts`** — update helper names
  and test descriptions for the IST rename.

**Docs:**

- **`progress.md`** — append a new row 91 documenting the descope:

   > | 91 | Bugfix — Create-Event gate + drop Coimbatore-only city/state lock | [impl-plan](docs/impl-plan/bugfix-create-event-gate-and-city-descope.md) | ✅ Complete | 2026-05-02 | 2026-05-02 |
   >
   > with a one-paragraph summary describing the gate refactor and the
   > city/state CHECK + Zod-literal relaxation.

- **`docs/v1-implementation-plan.md`** — under the I-1.2.1 row in the
  Phase 1 table and the Phase 1 / Module 1.2 row in the "Current State"
  table, append a one-line note:

   > Coimbatore-only city/state CHECK constraints relaxed to defaults
   > on 2026-05-02; country + timezone + paid-only locks retained. See
   > progress.md row 91.

- **No edits to `docs/product-plan.md`, `docs/requirements.md`,
  `docs/design-system*.md`.** They describe the launch wedge as a
  strategic narrative; relaxing the schema is a tactical hardening
  step that doesn't invalidate the wedge story.

- **No archive yet.** This plan stays under `docs/impl-plan/` until
  completion; archive on completion per `progress-tracking.instructions.md`.

### P2 verification

```sh
# DB layer
pnpm --filter @repo/db db:generate            # writes the next migration, currently 0019_<suffix>.sql
pnpm --filter @repo/db db:migrate:run         # apply to local Postgres
pnpm --filter @repo/db db:check:drift         # confirm schema and migrations are in sync
pnpm --filter @repo/db db:check:lock-risk     # should not flag the CHECK drops
pnpm --filter @repo/db db:check:rollbacks     # confirms rollback file exists
psql $DATABASE_URL -c "INSERT INTO events (id, organizer_id, title, slug, description, venue_name, address_line1, route_details, city, state, start_at, end_at) VALUES (gen_random_uuid(), '<existing-org>', 'Chennai 10K', 'chennai-10k', 'desc', 'venue', 'addr', 'route', 'Chennai', 'Tamil Nadu', now(), now() + interval '2 hours');"  # smoke: should succeed
psql $DATABASE_URL -c "INSERT INTO events (...) VALUES (..., 'Bangalore', 'Karnataka', ..., 'America/New_York', ...);"  # smoke: should fail with timezone CHECK violation
# No rollback runner currently exists; test rollback only against a disposable DB:
psql $DATABASE_URL -f packages/db/drizzle/rollbacks/0019_<suffix>.rollback.sql

# Schema + app layers
pnpm --filter @repo/shared test
pnpm --filter @repo/shared check-types
pnpm --filter api test
pnpm --filter api check-types
pnpm --filter web test
pnpm --filter web check-types
pnpm --filter @repo/db db:check:drift
pnpm --filter @repo/db db:check:lock-risk
pnpm --filter @repo/db db:check:rollbacks
pnpm lint                                     # Biome workspace-wide
```

Manual end-to-end:

1. As a verified organizer, navigate `/org/events/new`.
2. Form prefills City="Coimbatore", State="Tamil Nadu".
3. Edit City to "Chennai", State to "Tamil Nadu", complete the rest of
  the form, submit → toast "Event created as a draft: event-slug",
   redirected to category-config page.
4. Verify in DB: `SELECT city, state FROM events WHERE slug = '<slug>'`
   → returns Chennai / Tamil Nadu.
5. Direct API smoke (assumes valid CSRF + session cookie):

   ```sh
   curl -X POST http://localhost:3001/api/v1/events \
     -H "Content-Type: application/json" \
     -H "Cookie: ..." -H "x-csrf-token: ..." \
     -d '{"city":"Chennai","state":"Tamil Nadu","country":"Bhutan",...}'
   # Expected: 400 with "V1 event creation is limited to India"
   ```

---

## Adversarial review (round 2)

### Critical

**C1 — Drizzle generator may emit a full-table rebuild for
`sql.raw` CHECKs.** Drizzle's TypeScript schema diff has historically
struggled with `check(name, sql.raw(...))` because it fingerprints CHECK
bodies as opaque strings. If `db:generate` emits anything other than two
`ALTER TABLE ... DROP CONSTRAINT` statements (e.g., a `CREATE TABLE
events_new ... INSERT INTO events_new SELECT ... FROM events; DROP
TABLE events; ALTER TABLE events_new RENAME TO events;` rewrite), **stop
immediately** and hand-write the migration file; only touch Drizzle metadata if
you can keep it consistent with the existing migration baseline.
The two-line manual SQL is documented in P2a so a fallback is ready.
**Action in plan:** P2a explicitly calls this out with stop-instructions.

**C2 — Phase 1 dashboard regression.** Extracting the gate moves four
state groups out of `org/index.tsx`. The dashboard has **no existing
tests**, so a typo in the extraction (wrong query option, wrong CTA
copy, wrong link target) would silently land in production. **Mitigation:**
the new `<OrganizerSetupGate>` test covers the gate branches explicitly, and
the new `events/new.test.tsx` integration test exercises
the gate end-to-end via the route. The dashboard's content body
(`OrganizerDashboardContent`) is purely the welcome + verification card +
buttons block — moving 80 lines of unchanged JSX around is mechanical
and reviewable in the diff.

**C3 — UI-only policy gate is bypassable.** Current `createDraftEvent()` checks
for an organizer profile but does not check current policy acceptance. If this
plan only adds `<OrganizerSetupGate>`, a profile-bearing organizer can still
POST directly to `/api/v1/events` and create a draft without accepting policies.
**Action in plan:** P1.5 adds service-level policy enforcement and API tests.

**C4 — Verification command named a nonexistent rollback script.**
`@repo/db` has `db:check:rollbacks` but no `db:migrate:rollback` script. A plan
that asks implementers to run `db:migrate:rollback` will fail late. **Action in
plan:** P2 verification now validates rollback presence with the existing script
and documents manual `psql -f ...rollback.sql` rollback testing only against a
disposable DB.

### Important

**I1 — Test mock for `policyStatusQueryOptions` shape.** The dashboard
gate reads `policyQuery.data.allRequiredAccepted`. The new gate test
must mock the query to return `{ allRequiredAccepted: boolean }` —
verify the actual return shape from
[apps/web/src/features/organizer/queries.ts](../../apps/web/src/features/organizer/queries.ts)
before writing the mock so the type lines up. **Action in plan:**
P1.4 cites the existing dashboard query usage as the source of truth
for the mock shape.

**I2 — Help text for IST.** Renaming "Coimbatore local date" → "event
local date (IST)" is honest, but the `(IST)` suffix is jargon for some
users. Acceptable trade-off: the form already shows `Asia/Kolkata` in
the V1 constraint summary card above, so "IST" is contextualized. Plan
keeps the renamed copy.

**I3 — `V1_EVENT_ALLOWED_VALUES` still references city/state.** The
constant in `packages/shared/src/constants/event.ts` (line 152–161) is
exported but appears unused in production code paths after this slice
(it's likely read only by tests). **Action:** leave it untouched in this
slice; a follow-up cleanup pass can remove the city/state entries. Don't
bundle a constant-cleanup with a behaviour change.

**I4 — Existing API tests reject Chennai today.** The plan originally only
swept for literal response assertions, but `service.test.ts` and `routes.test.ts`
also contain invalid-V1-constraint table rows for `city: "Chennai"`. Those rows
must be removed or inverted, otherwise the API suite fails after the shared Zod
schema is relaxed. **Action in plan:** P2d now calls out those exact tests.

**I5 — Form layout shift.** Adding two real fields (City + State) where
a single disabled input lived will visibly change the form's vertical
rhythm. Cosmetic; one extra row in the grid. The plan calls for a
designer-eye check at implementation time but doesn't block on a Figma
mock — the existing form has no Figma reference either.

**I6 — Gate runs `policyStatusQueryOptions` even when the gate is
nested inside `_authed`.** The dashboard already does this; not a new
behaviour. The query is short and React-Query-cached; the gate component
mounts on a route with a known organizer-only audience. No CSRF / no
mutation. Safe.

**I7 — Event edit form still had city-named date copy.** The helper rename is
not enough: the edit form displays stored non-Coimbatore locations but its date
help text still says "Coimbatore local" / "Coimbatore day". **Action in plan:**
P2c.3 now updates the edit-form help text to IST wording.

### Improvement

**P1 — Same-day rule message.** When city/state become free-text but the
single-day rule still uses IST, an organizer in Mumbai who picks midnight
events spanning 23:30–01:30 IST will get "V1 events must start and end on
the same day" — but the rule is computed in IST, not the user's perceived
local timezone. Since `timezone` is locked to `Asia/Kolkata` for V1, this
is technically correct but potentially confusing. **Action:** leave
unchanged (out of scope; revisit when timezone lock is removed).

**P2 — Gate sub-components could be `memo()`'d.** Premature optimization;
each sub-component is a tiny `<Card>` and React 19 + the React Compiler
already handle this. Skip.

**P3 — Test for the specific link target.** Both new test suites should
assert `Link` `to` props match `/org/register` and `/org/policies`
(exact strings) so a typo or future TanStack Router rename fails loudly.

---

## Decisions (locked)

1. **Option B chosen** — drop city + state CHECKs and Zod literals; keep
   country, timezone, paid-only literals at both DB and Zod layers.
2. **Helper renames are mechanical** — `coimbatore*` → `ist*`. No logic
   changes; clarity-only refactor that prevents future confusion.
3. **Public marketing copy stays** — hero badge, `/about`, design-system
   docs, product/requirements docs all describe the launch wedge as
   positioning, not a system restriction.
4. **Phases 1 and 2 can run in parallel.** They overlap only on
   `apps/web/src/routes/_authed/org/events/new.tsx` where the subtitle
   "in Coimbatore" removal (P2) folds into the gate-wrap edit (P1.3).
5. **API defense-in-depth is in scope.** No new endpoint or response shape is
  added, but `POST /api/v1/events` now rejects users who have not accepted
  required organizer policies. This matches the UI gate and prevents direct
  API bypass.
6. **No edits to `docs/product-plan.md` / `docs/requirements.md`.** A
   one-liner in `docs/v1-implementation-plan.md` + a `progress.md` row
   is sufficient to keep the plan-vs-code in sync.
7. **The default form payload is unchanged.** `getDefaultCreateEventValues()`
   still prefills Coimbatore / Tamil Nadu — this preserves the pilot
   bias without preventing other cities.

## Further Considerations (deferred)

1. **Drop `country = 'India'` literal too.** Out of scope — adds
   currency / tax / compliance scope. Revisit during Phase 8 expansion.
2. **Drop `is_paid = true` literal.** Out of scope — free events bring
   an unbuilt parallel path (no payout flow). Revisit when free-event
   pricing is on the roadmap.
3. **Drop `timezone = 'Asia/Kolkata'` literal.** Out of scope — ripples
   into IST date helpers, single-day rule, public detail date renderers.
   Revisit when international expansion is on the roadmap (post-V2).
4. **Cleanup `V1_EVENT_ALLOWED_VALUES`.** A follow-up slice can remove
   `city` and `state` from this constant once nothing reads them as
   locks. Don't bundle here.
5. **Strengthen organizer-registration city validation.** It's currently
   free-text 2–100 chars. A future slice could add an Indian-cities
   typeahead (Algolia / Mapbox / static list). Out of scope.

## Tasks

<!-- markdownlint-disable MD060 -->

| #     | Task                                                                           | Status        | Completed |
| ----- | ------------------------------------------------------------------------------ | ------------- | --------- |
| P1.1  | Create `<OrganizerSetupGate>` in `apps/web/src/features/organizer/components/` | ⬜ Not started | —         |
| P1.2  | Refactor `org/index.tsx` to use the gate                                       | ⬜ Not started | —         |
| P1.3  | Wrap `EventCreateForm` in gate; drop "in Coimbatore" subtitle                  | ⬜ Not started | —         |
| P1.4  | Tests for gate + `events/new.test.tsx`                                         | ⬜ Not started | —         |
| P1.5  | Enforce policy acceptance in `createDraftEvent` + API tests                    | ⬜ Not started | —         |
| P2a.1 | Edit `packages/db/src/schema/events.ts` — remove 2 CHECKs                      | ⬜ Not started | —         |
| P2a.2 | Run `db:generate`; review next migration                                       | ⬜ Not started | —         |
| P2a.3 | Hand-write matching rollback file                                              | ⬜ Not started | —         |
| P2b.1 | Relax `city` + `state` Zod literals in `packages/shared/src/schemas/event.ts`  | ⬜ Not started | —         |
| P2b.2 | Rename `getCoimbatoreDateKey` → `getEventDateKeyInIst`                         | ⬜ Not started | —         |
| P2c.1 | Rename helpers in `apps/web/src/features/events/form-values.ts`                | ⬜ Not started | —         |
| P2c.2 | Update `event-create-form.tsx` (constraint summary + city/state fields + copy) | ⬜ Not started | —         |
| P2c.3 | Update `event-edit-form.tsx` imports + IST date help copy                      | ⬜ Not started | —         |
| P2d.1 | Update `packages/shared/test/schemas/event.test.ts`                            | ⬜ Not started | —         |
| P2d.2 | Update API event service/route tests for Chennai + policy enforcement          | ⬜ Not started | —         |
| P2d.3 | Add `event-create-form.test.tsx`                                               | ⬜ Not started | —         |
| P2d.4 | Update `form-values.test.ts` for IST helper rename                             | ⬜ Not started | —         |
| P2d.5 | Update `progress.md` + `docs/v1-implementation-plan.md`                        | ⬜ Not started | —         |
| V1    | Run all `pnpm --filter ... test` + `check-types` + `lint`                      | ⬜ Not started | —         |
| V2    | Run DB migration round-trip locally + smoke `INSERT` for Chennai               | ⬜ Not started | —         |
| V3    | Manual: log in as new organizer, validate gate + Chennai create flow           | ⬜ Not started | —         |

<!-- markdownlint-enable MD060 -->
