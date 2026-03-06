# CSRF Protection

## Overview

The portal uses **Signed Double-Submit Cookie** pattern for CSRF protection on all state-changing requests (POST, PUT, DELETE, PATCH). This is a defense-in-depth layer on top of the existing `SameSite=lax` cookie policy.

## How It Works

```
┌──────────┐                          ┌──────────┐
│  Browser  │                          │  Server   │
└─────┬────┘                          └─────┬────┘
      │  1. GET /dashboard                  │
      │ ──────────────────────────────────> │
      │  Set-Cookie: csrf_token=<signed>    │
      │ <────────────────────────────────── │
      │                                     │
      │  2. POST /api/some-action           │
      │  Cookie: csrf_token=<signed>        │
      │  X-CSRF-Token: <signed>             │
      │ ──────────────────────────────────> │
      │  ✓ Header matches cookie            │
      │  ✓ HMAC signature valid             │
      │  ✓ Token not expired                │
      │ <────────────────────────────────── │
      │  200 OK                             │
```

### Why this stops CSRF attacks

An attacker on a different origin:
1. **Cannot read** the `csrf_token` cookie (same-origin policy prevents cross-origin cookie reads)
2. **Cannot set** the `X-CSRF-Token` header (browsers block custom headers on cross-origin requests without CORS)
3. **Cannot forge** the token even if they guess the format (HMAC signature verification fails)

### Token format

```
{userId}.{timestamp_base36}.{hmac_sha256_hex}
```

- **userId** — binds the token to the authenticated user
- **timestamp** — base36-encoded `Date.now()`, used for 4-hour TTL check
- **hmac** — `HMAC-SHA256(derivedSecret, "{userId}.{timestamp}")`

The HMAC secret is derived from `AUTH_JWT_SECRET` via `HMAC-SHA256("csrf-token-salt", jwtSecret)` — no additional environment variable needed.

## Files

| File | Role |
|------|------|
| `portal/server/utils/csrf.ts` | Token generation, validation, cookie helpers |
| `portal/server/middleware/csrf.ts` | Server middleware — validates on POST/PUT/DELETE/PATCH |
| `portal/app/plugins/csrf.client.ts` | Client plugin — injects header on global `$fetch` |
| `portal/app/composables/useApiClient.ts` | API client composable — injects header via `onRequest` interceptor |
| `portal/server/utils/session.ts` | Sets CSRF cookie on login, clears on logout |

## Request Flow by Scenario

| Scenario | What happens |
|----------|-------------|
| **Page load (GET)** | Middleware sets/refreshes `csrf_token` cookie if user is authenticated |
| **Login** | Exempt path — no CSRF check. `createSession()` sets the cookie in the response |
| **POST/PUT/DELETE/PATCH** | Client reads cookie → sets `X-CSRF-Token` header → middleware validates header vs cookie vs HMAC |
| **Logout** | `destroySession()` clears both `auth_token` and `csrf_token` cookies |
| **API token (PAT/Bearer)** | Bearer header detected → CSRF validation skipped (not cookie-based, not CSRF-vulnerable) |
| **SSO callback** | GET request → safe method, no CSRF check needed |
| **Invite accept/register** | Exempt path — uses one-time invite token instead of session cookie |
| **Token expired (>4h)** | Returns 403 → next GET refreshes the cookie → client retry succeeds |

## Exempt Paths

These paths skip CSRF validation because they either don't use session cookies or use alternative authentication:

```
/api/auth/login          — no session exists yet
/api/auth/register       — no session exists
/api/auth/password/forgot — public endpoint, no session
/api/auth/password/reset — one-time reset token, no session
/api/auth/sso/           — SSO init/callback (GET-based redirects)
/api/auth/introspect     — uses x-service-token, not cookies
/api/invite/             — invite token as authentication
```

To add a new exempt path, edit the `EXEMPT_PATH_PREFIXES` array in `portal/server/middleware/csrf.ts`.

## For Frontend Developers

**You don't need to do anything.** CSRF headers are injected automatically by:

1. **`csrf.client.ts` plugin** — wraps `globalThis.$fetch` with a Proxy that adds the header
2. **`useApiClient()` composable** — has an `onRequest` interceptor that adds the header

Both mechanisms read the `csrf_token` cookie from `document.cookie` and add it as `X-CSRF-Token`.

### If you get a 403 "Missing CSRF token"

This means the client didn't send the `X-CSRF-Token` header. Possible causes:
- The request bypassed both `$fetch` and `useApiClient()` (e.g., raw `XMLHttpRequest` or `fetch()`)
- The `csrf_token` cookie is missing (user needs to make a GET request first to get one)

**Fix:** Use `$fetch` or `useApiClient()` for all API calls. If you must use raw `fetch()`, manually read the cookie and set the header:

```ts
const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1]
fetch('/api/something', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken ? decodeURIComponent(csrfToken) : '',
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify(data)
})
```

### If you get a 403 "Invalid CSRF token"

The token exists but failed validation. Possible causes:
- Token is older than 4 hours (TTL expired)
- Token was generated for a different user
- Token was tampered with

**Fix:** Make any GET request to refresh the cookie, then retry.

## For Backend Developers

### Adding a new exempt path

If you're creating a new API route that uses non-cookie authentication (e.g., webhook with signature verification), add the path prefix to `EXEMPT_PATH_PREFIXES` in `portal/server/middleware/csrf.ts`.

### Middleware execution order

Nitro middleware runs alphabetically:
1. `auth.ts` — populates `event.context.auth`
2. `csrf.ts` — validates CSRF (depends on auth being populated first)
3. `logging.ts`
4. `login-branding.ts`

The `csrf` middleware depends on `auth` running first to populate `event.context.auth`. The alphabetical ordering ensures this.

## Security Properties

- **HMAC-SHA256 signatures** — tokens can't be forged without the server secret
- **Timing-safe comparison** — uses `crypto.timingSafeEqual` to prevent timing attacks
- **User-bound tokens** — a token from user A can't be used for user B
- **4-hour TTL** — limits the window for token reuse
- **Derived secret** — CSRF secret is derived from `AUTH_JWT_SECRET`, no additional configuration needed
- **Cookie attributes** — `SameSite=lax`, `Secure` in production, `httpOnly=false` (intentional — JS needs to read it)
