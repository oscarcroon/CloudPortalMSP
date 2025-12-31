---
name: OpenAPI+Tokens v2
overview: Reviderad plan för två OpenAPI-specs (internal/public) och org API tokens, med deterministisk generation (inga handler-imports), tydliga securitySchemes (JWT vs opaque), återanvändning av befintlig audit_logs och minimal påverkan på befintliga sessionflöden.
todos:
  - id: scan-routes-internal
    content: Implementera route-scanner och generera `frontend/server/openapi/generated/routes.internal.generated.ts` (path+method+tags).
    status: completed
  - id: build-spec-core
    content: Skapa `frontend/server/openapi/spec.ts` med `buildOpenApi({mode})` och säkerhets-/felstandarder.
    status: completed
    dependencies:
      - scan-routes-internal
  - id: serve-internal-docs
    content: Skapa `openapi.internal.json` endpoint + `/docs/internal` Swagger UI och skydda med session (+ rekommenderat superadmin).
    status: completed
    dependencies:
      - build-spec-core
  - id: public-openapi-metadata
    content: Inför `*.openapi.ts` konvention + generator till `operations.public.generated.ts` och bygg public spec från opt-in.
    status: completed
    dependencies:
      - build-spec-core
  - id: bearer-jwt-support
    content: Uppdatera session-auth så Bearer JWT accepteras (utan att behandla PAT som session).
    status: completed
    dependencies:
      - serve-internal-docs
  - id: org-api-tokens
    content: "Implementera org PAT: DB-tabell+migration, KeyProvider/EnvKeyProvider, verify/ensureOrgApiToken, scopes/constraints enforcement, rate limit keys och audit-loggning."
    status: completed
    dependencies:
      - public-openapi-metadata
      - bearer-jwt-support
---

# Plan: OpenAPI/Swagger + Public API Tokens (Nuxt 4/Nitro, Zod-first)

## Rekommenderade ändringar (diff mot tidigare)

1. **Separera auth-kontext tydligt**

- Behåll `ensureAuthState()` för **session** (cookie + Bearer JWT).
- Inför separat `ensureOrgApiToken()` för **PAT**.
- Undvik att PAT “råkar” tolkas som session.

2. **Två securitySchemes i OpenAPI**

- `SessionJWT` (http bearer, `bearerFormat: JWT`)
- `OrgApiToken` (http bearer, `bearerFormat: Opaque`)
- Sätt security **per operation** (internal=SessionJWT, public=OrgApiToken).

3. **Deterministiska specs**

- Generera routes/operations artefakter i build/CI.
- Inga filesystem-scans vid runtime i prod.
- Undvik import av handlers i OpenAPI-generationen.
- Artefakter under `frontend/server/openapi/generated/**`.
- Runtime-endpoints serverar genererade specs.

4. **Återanvänd befintlig audit**

- Använd existerande `audit_logs` + `logSecurityEvent()`.
- Lägg till `API_TOKEN_USED` och `API_TOKEN_AUTH_FAILED` (eller återanvänd befintliga eventtyper med meta).

5. **Token-hash utan extra native deps**

- Om ni vill undvika `argon2`: använd `crypto.scrypt` + unik salt per token + pepper via `KeyProvider`.
- Spara även `hash_params` + `hash_version`.
- Verifiera med `timingSafeEqual`.

6. **Tokenformat med lookup-prefix**

- Prefix är explicit del av tokensträngen för snabb DB-lookup.
- **Prefix ska vara globalt unikt** (UNIQUE index), så lookup kan göras utan org-kännedom.
- Hasha **endast secret-delen**, inte hela tokensträngen.

7. **Robust token-parsing**

- Välj charset som inte krockar med separatorer.
- Rekommendation: prefix i **base32** (A–Z2–7), secret i **base64url** utan `_` (eller använd `.` som separator).
- Dokumentera exakt format.

8. **KeyVault-ready på riktigt**

- `KeyProvider` har cache (TTL) och tydlig rotationspolicy:
    - “current pepper” för mint
    - “legacy peppers” för verify under en avvecklingsperiod

9. **Public consumption readiness**

- Public spec har tydliga `servers` (prod/stage) och dokumenterad CORS-policy.
- Rate limit svar inkluderar `Retry-After` (när möjligt) och standardiserat 429-fel.

---

## Mål

### OpenAPI/Swagger

- **Internal spec:** täckning av alla Nitro-routes (inkl. layers) för dev/QA/felsökning.
- **Public spec:** opt-in kontrakt (endast endpoints som explicit publiceras).
- **Swagger UI:**
- `/docs/internal` (auth-skyddad; rekommenderat: endast superadmin/dev)
- `/docs/public` (auth-skyddad enligt policy)

### Auth & Tokens

- Standardisera “Try it out” och externa klienter via `Authorization: Bearer <token>`.
- Två token-typer:
- **Session JWT:** befintlig token (cookie) även accepterad som Bearer.
- **Org API Token:** opaque PAT (skapas av org owner/admin), scopes, constraints, hashad, rate-limitad, audit-loggad.
- **KeyVault-ready:** `KeyProvider` + `pepper_kid`.

### Zod → Validation → OpenAPI

- Zod-scheman återanvänds för:
- requestvalidering (body/query/params)
- OpenAPI schema generation

---

## Fas A — Internal spec (100% route coverage, deterministisk)

### A1) Route inventory (scanner)

Skapa generator som scannar:

- `frontend/server/api/**`
- `frontend/layers/*/server/api/**`

Härled:

- `path` (inkl. prefix `/api`, samt `[param]` → `{param}`)
- `method` från suffix (`*.get.ts`, `*.post.ts`, ...)
- `tags` från mappstruktur/layer

Output (genererad TS):

- `frontend/server/openapi/generated/routes.internal.generated.ts`

> Körs i build/CI. Ingen runtime-scan i prod.

### A2) OpenAPI builder (internal)

Skapa `frontend/server/openapi/spec.ts`:

- `buildOpenApi({ mode: 'internal' | 'public' })`

Internal bygger paths från `routes.internal.generated.ts`.Schemas i Fas A: generiska placeholders men korrekt method/path.**SecuritySchemes** inkluderar båda, men **internal operations** ska default ha:

- `security: [{ SessionJWT: [] }]`

### A3) Exponera internal JSON + docs

Nitro endpoints:

- `frontend/server/api/openapi.internal.json.get.ts`
- `frontend/server/routes/docs/internal.get.ts`

Auth:

- `requireSession()` + `requireSuperAdmin()` (för att internal docs inte ska bli “allmänt admin”-verktyg i prod)

---

## Fas B — Public spec (opt-in + Zod metadata, deterministisk)

### B1) Operation metadata utan side effects

Per endpoint (opt-in): `*.openapi.ts` (ren metadata, inga timers/DB etc).Exportera t.ex. `defineOperation({ public: true, ... })` med:

- `summary`, `description`, `tags` (gärna `public:*` eller `x-public-group`)
- Zod `params/query/body`
- `responses` (minst 2xx + standardfel)
- `security`: normalt `[{ OrgApiToken: [] }]`
- `x-required-scopes: string[]` (obligatoriskt för public)
- ev. `x-resource-constraints`

**CI-regel:** public operations måste ha `summary`, `description`, `x-required-scopes`, och standard responses 401/403/429.

### B2) Zod → OpenAPI

Installera `@asteasolutions/zod-to-openapi`.Skapa `frontend/server/openapi/zod.ts`:

- central registry för stabila schema-namn
- helpers som registrerar Zod → OpenAPI
- konvention: applicera `.openapi()`/metadata sist via helper för att minska metadata-loss

### B3) Deterministisk public generation

Skapa generator som scannar `**/*.openapi.ts` och bygger en statisk lista över **public** operations.Output:

- `frontend/server/openapi/generated/operations.public.generated.ts`

`buildOpenApi({ mode: 'public' })` tar endast dessa operations.

### B4) Exponera public JSON + docs

Nitro endpoints:

- `frontend/server/api/openapi.public.json.get.ts`
- `frontend/server/routes/docs/public.get.ts`

Auth:

- start: `requireSession()` (admin)
- senare: policy-styrt (t.ex. org owners kan se public docs)
- dokumentera hur org token kan användas i Swagger UI (om ni tillåter det)

### B5) Servers + CORS för public yta

- `servers` i public spec ska spegla era miljöer (prod/stage) via config.
- Dokumentera CORS-policy:
- Server-to-server: CORS kan vara avstängt (rekommenderat default).
- Browser-baserade integrationer: explicit allowlist per origin om det behövs.

---

## Fas C — Org API Tokens (PAT): modell + auth + scopes + rate limit + audit

### C1) Datamodell (Drizzle)

Lägg till tabell `org_api_tokens` (schema + migration) med minst:

- `id` (CUID2)
- `org_id`
- `prefix` (global lookup, **unik**, indexerad)
- `hash_alg` (t.ex. `scrypt-v1`)
- `hash_version` (t.ex. `1`)
- `hash_params` (json/text: `N`, `r`, `p`, `keylen`, etc.)
- `salt` (base64)
- `token_hash` (base64)  ← hash av **secret-only**
- `pepper_kid`
- `scopes` (json/text)
- `resource_constraints` (json/text)
- `description`
- `created_by_user_id`
- `expires_at`, `revoked_at`, `last_used_at`

Indexer:

- `org_id`
- `prefix` (**UNIQUE**)
- `revoked_at` (för filtrering)
- ev. `(org_id, revoked_at)` beroende på queries

### C2) Tokenformat (lookup-first, robust parsing)

Rekommendation:

- `msp_pat.<prefix>.<secret>`

Där:

- `<prefix>`: 12–16 tecken **base32** (A–Z2–7), globalt unikt
- `<secret>`: 32+ bytes random, **base64url** (utan `.`)

DB lookup sker på `<prefix>`.Verifiering sker genom hash av **secret** (+ salt + pepper).> Dokumentera formatet exakt i public docs.

### C3) KeyProvider (KeyVault-ready)

`frontend/server/security/keys/KeyProvider.ts`:

- `getPepper(kid?: string)`
- `getAllPeppersForVerification(kid?: string)` (current + legacy)

`EnvKeyProvider`:

- läser `TOKEN_PEPPER_CURRENT`
- läser `TOKEN_PEPPER_LEGACY_JSON` (valfritt)

**Cache:**

- Cacha peppers i minne med TTL (t.ex. 1–5 min).
- Miss/refresh ska vara safe.

**Rotation-policy:**

- Mint nya tokens med `current kid`.
- Verify med `current + legacy`.
- Planerad avveckling av legacy efter X dagar/veckor.

### C4) Auth på requestnivå (utan att bryta sessionflöden)

Behåll `frontend/server/utils/session.ts`:

- acceptera Bearer **endast om** token ser ut som JWT (tre segment med `.`)
- annars ignorera (så PAT inte “råkar” bli session)

Inför `frontend/server/security/apiTokens/ensureOrgApiToken.ts`:

- parse `Authorization: Bearer ...`
- om JWT: return null (inte PAT)
- annars:
- parse tokenformat `msp_pat.<prefix>.<secret>`
- DB lookup på `prefix`
- check `revoked_at`, `expires_at`
- hämta peppers via `KeyProvider` (current + legacy)
- verifiera hash med `crypto.scrypt` + `salt` + pepper
- jämför hash med `timingSafeEqual`
- returnera `{ tokenId, orgId, scopes, constraints }`

Lägg auth-resultat i:

- `event.context.orgApiToken` (inte i session/auth-context)

### C5) Scopes & constraints enforcement

- `requireOrgApiToken(event)` (måste finnas)
- `requireOrgApiScopes(event, scopes: string[])`
- `requireOrgConstraint(event, constraintCheck)` (t.ex. allowlist på orgId/zoneId)

**Docs ↔ runtime koppling:**

- `.openapi.ts` exporterar `x-required-scopes`.
- runtime använder samma scopes-lista (import från metadata eller delad constants) för att minimera drift.

### C6) Rate limiting

Återanvänd `frontend/server/utils/rateLimit.ts` men komplettera med en “store strategy”:

- dev: in-memory
- prod: pluggbar store (redis) när/om ni kör fler instanser

Key:

- per `tokenId`
- per `orgId`

Svar:

- 429 med standard ErrorResponse
- sätt `Retry-After` när möjligt
- (valfritt) `X-RateLimit-*` headers om ni vill hjälpa integratörer

### C7) Audit

Återanvänd `frontend/server/utils/audit.ts` + `audit_logs`.Logga:

- create/revoke (befintliga `API_TOKEN_CREATED` / `API_TOKEN_REVOKED`)
- usage/auth_failed:
- lägg till `API_TOKEN_USED` och `API_TOKEN_AUTH_FAILED`
- eller återanvänd befintliga eventtyper med tydlig `meta.eventSubtype`

Viktigt:

- `sanitizeMetadata()` redaktar “token”-fält redan.
- logga aldrig secret/plaintext.

### C8) UI för token-hantering

I org admin UI:

- lista tokens (prefix, description, scopes, created_at, last_used_at, expires_at, status)
- create token (scope picker + templates)
- revoke token
- plaintext-token visas **endast vid skapande**

---

## CI / Governance

### Scripts

Lägg till i `frontend/package.json`:

- `generate:openapi`
- genererar:
    - `routes.internal.generated.ts`
    - `operations.public.generated.ts`
    - (valfritt) `openapi/internal.json` och `openapi/public.json` som artefakter för diff/review

### CI checks

- Public operations:
- måste ha `public: true`
- måste ha `summary`, `description`, `x-required-scopes`
- måste dokumentera standard responses: 401/403/429
- Internal spec:
- måste innehålla alla routes från scanner
- OpenAPI-generation måste vara deterministisk (ingen handler-import, ingen runtime-scan).

---

## Acceptanskriterier

- `GET /api/openapi.internal.json` fungerar och innehåller alla Nitro-routes.
- `GET /api/openapi.public.json` innehåller endast opt-in operations.
- `/docs/internal` och `/docs/public` fungerar och är auth-skyddade.
- Swagger UI kan anropa endpoints med:
- `SessionJWT` (Bearer JWT)
- `OrgApiToken` (Bearer opaque PAT)
- Org owner/admin kan skapa/revoka PAT:
- prefix-lookup fungerar