# Cloudflare CDN setup — EventKart production zone

> **Feature:** I-2.4.1 — Cloudflare CDN setup (DNS, SSL, caching rules for SSR pages)
> **Audience:** Operators / on-call. This is a **runbook**, not application code.
> **Scope:** zone-level configuration to be applied via the Cloudflare dashboard or
> Terraform. The repo deliverables for I-2.4.1 are env vars
> (`CLOUDFLARE_*`, `CDN_BASE_URL` in `apps/api/src/lib/config.ts`) and the
> SSR cache contract enforced by `setPublicEventCacheHeaders` /
> `setOrganizerDetailCacheHeaders`. The actual zone changes documented
> below are applied **out-of-band** by an operator with Cloudflare admin
> access — no code in this repo calls the Cloudflare provisioning API.

---

## 0. Prerequisites

- Cloudflare account with admin access to the `eventkart.in` zone (and
  the `staging.eventkart.in` zone for pre-prod).
- DNS delegation for `eventkart.in` already pointed at Cloudflare
  nameservers (handled at the registrar — out of scope for this doc).
- Railway production deployment URLs for both `web` and `api` services
  available (Railway → Service → Settings → Public Networking).
- The four env vars in `apps/api/.env.example` configured as Railway
  secrets in production (`CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_PURGE_ENABLED`, `CDN_BASE_URL`). I-2.4.2 consumes these
  to issue cache purges; I-2.4.1 only requires the secrets to exist as
  Railway-side configuration so the deploy doesn't crash on boot.

---

## 1. DNS records

| Record | Name                  | Type    | Target                                  | Proxy       | Notes                                                                         |
| ------ | --------------------- | ------- | --------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| Apex   | `eventkart.in`        | `CNAME` | Railway web public hostname             | 🟠 Proxy    | Cloudflare apex CNAME flattening (allowed on free plan and above).            |
| WWW    | `www.eventkart.in`    | `CNAME` | `eventkart.in`                          | 🟠 Proxy    | Page rule below 301-redirects `www` → apex so the canonical host is the apex. |
| API    | `api.eventkart.in`    | `CNAME` | Railway api public hostname             | 🟠 Proxy    | Proxy enabled for DDoS + WAF; rate limiting still enforced server-side.       |
| Status | `status.eventkart.in` | `CNAME` | (status page provider, e.g. Statuspage) | ⚫ DNS only | DO NOT proxy — status pages must be reachable when Cloudflare has issues.     |

**Email / SPF / DKIM / DMARC records** are out of scope for I-2.4.1 — they
ride alongside SES/Resend setup (handled by the messaging module owners).
Leave any existing email records in place; do not delete them while
adding the records above.

> **Reminder:** Any future Railway service rename re-issues a new public
> hostname. Update the relevant CNAME target the same day or the apex
> stops resolving.

---

## 2. SSL / TLS

| Setting                    | Value                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| SSL/TLS encryption mode    | **Full (strict)**                                                                                            |
| Edge certificates          | Universal SSL (default, free)                                                                                |
| Always Use HTTPS           | **On**                                                                                                       |
| Automatic HTTPS Rewrites   | **On**                                                                                                       |
| Minimum TLS version        | **TLS 1.2** (raise to 1.3 once analytics confirm zero TLS 1.2 traffic)                                       |
| Opportunistic Encryption   | On                                                                                                           |
| TLS 1.3                    | On                                                                                                           |
| HSTS                       | **On** — `max-age=31536000`, include subdomains, preload OFF until the apex has been HTTPS-only for 30+ days |
| Authenticated Origin Pulls | Off in V1 (revisit for I-2.4.2 hardening)                                                                    |

**Why Full (strict):** Railway terminates a real Let's Encrypt cert on the
origin, so strict validation catches origin misconfigurations early.
**Flexible** mode would allow plaintext between Cloudflare and Railway,
breaking cookie `Secure` semantics and the CSRF model.

---

## 3. Caching — page / cache rules

The application already advertises the SSR cache contract via the helpers
in `apps/web/src/features/event-detail/cache-headers.ts` and
`apps/web/src/features/organizer-detail/cache-headers.ts`:

```
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
```

Cloudflare needs a matching rule so the proxy actually honors `s-maxage`
on HTML responses (its default behavior is to skip caching HTML even
when the origin opts in via `s-maxage`). Use the **Cache Rules** engine
(modern; replaces the legacy "Page Rules" three-rule limit).

### 3.1 SSR HTML routes (`/events/*`, `/organizers/*`)

| Field                        | Value                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| Rule name                    | `ssr-cache-public-pages`                                               |
| When incoming requests match | URI Path: `starts_with` `/events/` **OR** `starts_with` `/organizers/` |
| Eligible for cache           | **Yes**                                                                |
| Edge TTL                     | **Respect origin** (use `s-maxage=60` from the response)               |
| Browser TTL                  | **Respect origin**                                                     |
| Cache key                    | Default + ignore query string                                          |
| Serve stale                  | **On — while updating** (matches `stale-while-revalidate`)             |
| Vary for images              | n/a                                                                    |

These two paths are slug-only (`/events/:slug`, `/organizers/:slug`) and
take no meaningful query parameters, so "ignore query string" is safe
and improves hit rate against tracker noise (`?utm_source=…`, `?gclid=…`).

**Critical: do NOT add `Cookie` to the cache key.** The application
deliberately omits `Vary: Cookie` (see §6 cache contract). Adding the
session cookie to the cache key would shred hit rate to ~0% for any
authenticated user.

**Out of scope for I-2.4.1: the homepage `/`.** It is intentionally
excluded from this rule. The `_public/` index route accepts query
parameters that change the render (`page`, `sort`, `reason`, `redirect`
— see `apps/web/src/routes/_public/index.tsx`), so the "ignore query
string" cache key would serve the wrong page or surface a stale
"please sign in" toast to other visitors. A separate ticket should
either (a) add a `homepage-cache-public` rule that pins the cache key
to a normalised allowlist of safe params, or (b) defer caching `/`
until the homepage is refactored to be SSR-cache-friendly.

### 3.2 Static assets (`/_build/*`, `/assets/*`)

Vite emits hashed asset filenames under `/_build/` (or `/assets/` for the
classic Vite layout depending on the build mode). These are
content-addressed and safe to cache aggressively.

| Field                        | Value                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| Rule name                    | `static-assets-immutable`                                          |
| When incoming requests match | URI Path: `starts_with` `/_build/` **OR** `starts_with` `/assets/` |
| Eligible for cache           | **Yes**                                                            |
| Edge TTL                     | **1 year (31536000 s)**                                            |
| Browser TTL                  | **1 year**                                                         |
| Cache key                    | Default                                                            |

The application also emits `Cache-Control: public, max-age=31536000,
immutable` for these paths (Vite default). The Cloudflare rule mirrors
that contract so a misbehaving origin still benefits from edge caching.

### 3.3 SEO surfaces (`/sitemap.xml`, `/robots.txt`)

| Field                        | Value                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| Rule name                    | `seo-surfaces`                                                         |
| When incoming requests match | URI Path: `eq` `/sitemap.xml` **OR** `eq` `/robots.txt`                |
| Eligible for cache           | **Yes**                                                                |
| Edge TTL                     | **1 hour (3600 s)** — matches the I-2.4.4 sitemap regeneration cadence |
| Browser TTL                  | **1 hour**                                                             |
| Cache key                    | Default                                                                |

Sitemap regeneration (I-2.4.4) issues a targeted purge of `/sitemap.xml`
on event publish/unpublish. `robots.txt` is shipped as a static file
(I-2.4.5) and changes only with code deploys.

### 3.4 API surface (`/api/*`)

| Field                        | Value                           |
| ---------------------------- | ------------------------------- |
| Rule name                    | `api-bypass-cache`              |
| When incoming requests match | URI Path: `starts_with` `/api/` |
| Eligible for cache           | **No — Bypass cache**           |

The Fastify API serves authenticated, mutating, and per-user data. Edge
caching anything under `/api/` is unsafe. `api.eventkart.in` is a
separate hostname so this rule is technically belt-and-braces, but it
prevents accidental damage if a future routing change ever fronts the
API behind the apex.

### 3.5 Dynamic / authenticated routes (`/org/*`, `/admin/*`, `/my/*`, `/book/*`)

| Field                        | Value                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Rule name                    | `authed-bypass-cache`                                                                                                    |
| When incoming requests match | URI Path: `starts_with` `/org/` **OR** `starts_with` `/admin/` **OR** `starts_with` `/my/` **OR** `starts_with` `/book/` |
| Eligible for cache           | **No — Bypass cache**                                                                                                    |

These routes are SSR `data-only` (per
`.github/instructions/tanstack-start.instructions.md`) and depend on the
session cookie. Caching would be a confused-deputy / privacy bug.

### 3.6 Rule order

Cache Rules evaluate top-down. Order them:

1. `api-bypass-cache`
2. `authed-bypass-cache`
3. `static-assets-immutable`
4. `seo-surfaces`
5. `ssr-cache-public-pages`

### 3.7 Origin Rule — `eventkart.in/sitemap.xml` → API origin (I-2.4.4)

The `/sitemap.xml` URL must live on the apex hostname so crawlers
discover it at `https://eventkart.in/sitemap.xml`, but the actual
generator and Redis cache live in the API service at
`api.eventkart.in/api/v1/sitemap.xml`. An **Origin Rule** rewrites the
host + path at the edge so the public URL stays canonical while the
implementation is owned by the API.

Rule (Cloudflare → Rules → Origin Rules → Create rule):

- **Name**: `sitemap-to-api`
- **When incoming requests match**:
  - `(http.host eq "eventkart.in" and http.request.uri.path eq "/sitemap.xml")`
- **Then**:
  - **Override Host header** → `api.eventkart.in`
  - **Override URI path** → `/api/v1/sitemap.xml`

The cache key for §3.3 is keyed on `eventkart.in/sitemap.xml`, so the
edge cache continues to honour the `Cache-Control: max-age=3600,
stale-while-revalidate=86400` headers the API emits. Crawlers see one
canonical URL; the API gets to use its normal `/api/v1` versioning.

Validation:

```bash
# Should return 200 with XML even when the API is briefly unreachable
# (Cloudflare serves the 1h cached copy; SWR refreshes for 24h after).
curl -I https://eventkart.in/sitemap.xml
# Expect: content-type: application/xml; charset=utf-8
#         cache-control: public, max-age=3600, stale-while-revalidate=86400
```

When this rule is **NOT** in place, `eventkart.in/sitemap.xml` returns
a 404 from the SSR app. That's the symptom that the Origin Rule was
deleted or misconfigured.

---

## 4. DDoS / security

| Setting                          | Value                                                           |
| -------------------------------- | --------------------------------------------------------------- |
| Security Level                   | **Medium** (default)                                            |
| Bot Fight Mode                   | **On** (free tier; upgrade to Super Bot Fight Mode if Pro plan) |
| Browser Integrity Check          | **On**                                                          |
| Challenge Passage                | 30 minutes                                                      |
| WAF — Cloudflare Managed Ruleset | **On** (default action: managed)                                |
| Rate Limiting Rules              | See below                                                       |
| HTTP DDoS Attack Protection      | **On** (default; sensitivity: High)                             |
| L3/L4 DDoS                       | Always-on (free; no configuration)                              |

### 4.1 Rate limiting (edge — defence in depth, app still enforces its own)

| Rule name        | Path                    | Threshold           | Action       |
| ---------------- | ----------------------- | ------------------- | ------------ |
| `otp-send-burst` | `/api/v1/auth/otp/send` | 10 req / 60 s / IP  | Block 10 min |
| `bookings-burst` | `/api/v1/bookings`      | 30 req / 60 s / IP  | Block 5 min  |
| `api-default`    | `/api/*`                | 600 req / 60 s / IP | Challenge    |

These are **edge** rate limits — the application also rate-limits per the
table in `.github/instructions/fastify-backend.instructions.md`. The edge
limits are intentionally looser; they exist to absorb obvious flooding
before it reaches Railway. Tighten only if origin metrics show abuse
pinholing through.

---

## 5. Cloudflare API token (used by I-2.4.2)

I-2.4.1 itself never calls the Cloudflare API. I-2.4.2 (cache invalidation)
will read `CLOUDFLARE_API_TOKEN` from `fastify.config` and POST to
`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`.
The token must be **created and rotated by hand** — there is no
self-service path for this.

### 5.1 Token scope (least privilege)

Create a **scoped API token** (not a global API key, not an account-level
token) at <https://dash.cloudflare.com/profile/api-tokens> with:

| Permission           | Resource                      |
| -------------------- | ----------------------------- |
| `Zone — Cache Purge` | Specific zone: `eventkart.in` |

Optional but recommended:

- **Client IP Address Filtering:** restrict to Railway's outbound IP
  ranges (from Railway support / docs) once known.
- **TTL:** set an explicit expiration matching the rotation cadence
  (90 days), so a missed rotation fails closed instead of silently
  drifting.

### 5.2 Token rotation runbook

**Cadence:** every 90 days. Calendar reminder owned by the Platform on-call.

1. **Pre-flight (T-7 days):** Confirm Railway deploys are green; do not
   rotate during a release freeze.
2. **Generate new token** in the Cloudflare dashboard with the same
   scope as §5.1. Copy the value; the dashboard shows it once.
3. **Canary the new token out-of-band.** `loadConfig` only knows the
   `CLOUDFLARE_API_TOKEN` name — it does NOT validate any
   `*_NEXT` variant. Before touching prod env vars, prove the new
   token works by issuing a single trivial Cloudflare API call
   (e.g. `GET /user/tokens/verify`) from your workstation with the
   new token in the `Authorization: Bearer …` header. Expect
   `200 { success: true }`. If you get `401`/`403`, the token scope
   is wrong — go back to step 2. **Do not stage the secret in
   Railway until this passes.**
4. **Promote** by overwriting `CLOUDFLARE_API_TOKEN` in Railway with
   the new value. Trigger a deploy. Confirm the api service boots
   without the
   `Invalid configuration: CLOUDFLARE_PURGE_ENABLED is true but ...`
   error pattern in Railway logs.
5. **Smoke** by triggering a CDN purge from the admin tooling (I-2.4.2)
   and confirming the request returns `200` with `success: true`.
6. **Revoke** the old token at <https://dash.cloudflare.com/profile/api-tokens>
   only after step 5 confirms the new one works. **Never** keep both
   tokens valid for more than the single deploy window — the old one
   becomes a long-lived secret with no rotation owner.
7. **Audit** that the rotation event is recorded in the platform audit
   log (manual entry until I-7.x audit module covers infra).

**Compromise response:** if a token leaks (e.g. checked into a public
repo, shown in a screenshare), revoke immediately at the Cloudflare
dashboard, then run steps 2–5 with `CLOUDFLARE_PURGE_ENABLED=false` set
during the gap so I-2.4.2 fails closed (log-only no-op) instead of
hammering the API with `403`s.

---

## 6. Cache contract (the bytes Cloudflare sees)

This is the single source of truth for the response headers Cloudflare's
cache rules in §3.1 are matched against. The constants live in code:

- `apps/web/src/features/event-detail/cache-headers.ts` →
  `PUBLIC_EVENT_CACHE_CONTROL`
- `apps/web/src/features/organizer-detail/cache-headers.ts` →
  `ORGANIZER_DETAIL_CACHE_CONTROL`

Both equal **`public, s-maxage=60, stale-while-revalidate=300`**, with a
regression test in
`apps/web/src/features/{event,organizer}-detail/cache-headers.test.ts`
asserting:

1. The string is `public, s-maxage=60, stale-while-revalidate=300`
   exactly.
2. The string contains neither `private` nor `no-store`.
3. The helper does **not** inject a `Vary` header (in particular not
   `Vary: Cookie`).

### Why no `Vary: Cookie`

The public event and organizer detail responses are **identical for all
callers** — they render no per-user data and use no per-user state. They
are SSR'd from data fetched over the internal API with no auth context
at all (the loader does not forward `kiran_session`).

Adding `Vary: Cookie` would tell Cloudflare to treat each distinct
cookie value as a separate cache entry. With session cookies that are
unique per user, the cache hit rate would collapse to nearly zero,
defeating the entire purpose of CDN caching.

If a future change ever needs to vary the response by anything (e.g.
language, currency), introduce a deliberate, narrow `Vary` value
(`Vary: Accept-Language`) — never `Vary: Cookie`.

### Why `s-maxage=60` and `stale-while-revalidate=300`

- `s-maxage=60` — fresh window. Edge serves the cached response
  unconditionally for 60 seconds without contacting the origin.
- `stale-while-revalidate=300` — soft TTL. Between 60s and 360s edge
  serves the stale response immediately AND triggers an async refetch
  in the background. Caps tail latency at 60s and absorbs
  publish/unpublish bursts.
- Origin cache invalidation (I-2.4.2) issues an explicit Cloudflare
  purge for `/events/<slug>` and `/organizers/<slug>` on event publish,
  unpublish, pricing change, capacity change, and admin moderation.
  The 60s TTL is the **maximum** drift between origin truth and edge
  cache for events that were never touched after publish.

---

## 7. Validation after applying

- `dig +short eventkart.in @1.1.1.1` → returns Cloudflare proxy IPs
  (104.16.x / 172.67.x).
- `curl -I https://eventkart.in/events/<known-slug>` →
  `cache-control: public, s-maxage=60, stale-while-revalidate=300`,
  `cf-cache-status: HIT` after the second request.
- `curl -I https://eventkart.in/api/v1/health` →
  `cf-cache-status: BYPASS`.
- `curl -I https://eventkart.in/_build/<hashed-asset>` →
  `cache-control: public, max-age=31536000, immutable`,
  `cf-cache-status: HIT`.
- Cloudflare dashboard → Analytics → Cache → confirm hit rate >70 %
  on `/events/*` traffic within 15 minutes of warm-up.
- Confirm no response on any cached path includes `Vary: Cookie` (use
  `curl -I` and `grep -i ^vary:`).

---

## 8. Out of scope for I-2.4.1

These are explicitly handled by sibling features and **not** by this
runbook:

- I-2.4.2 — programmatic cache purges from the API on event mutations.
- I-2.4.3 — origin-side single-flight / Redis lock for cache stampede.
- I-2.4.4 — `sitemap.xml` generation + serving + invalidation.
- I-2.4.5 — `robots.txt` content.
- I-2.4.6 — slug 301 redirect handler (already wired in I-1.2.10 +
  I-2.3.5; runs at the application layer, not the edge).
- Email DNS (SPF / DKIM / DMARC) — owned by the messaging module.
- Authenticated Origin Pulls — deferred until I-2.4.2 stabilizes.
