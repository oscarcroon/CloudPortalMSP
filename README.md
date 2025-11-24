# Cloud Customer Portal

Skeleton for a multi-tenant “single pane of glass” portal that manages Cloudflare, Incus, ESXi/Morpheus and WordPress resources.

## Structure

```
frontend/   Nuxt 3 + Tailwind + Pinia SPA/SSR hybrid
backend/    Node (Express + TypeScript) API gateway
env.example Sample environment variables for both apps
```

## Getting Started

1. **Install Node.js 18+** (or enable Corepack).  
2. **Install dependencies**

```bash
cd frontend && npm install
cd ../backend && npm install
```

3. **Configure environment**

```
cp env.example .env.local   # or set vars in your shell
```

4. **Run the development servers**

```bash
# Terminal 1 – API
cd backend
npm run dev

# Terminal 2 – Nuxt frontend
cd frontend
npm run dev
```

Nuxt proxies `/api/*` requests to `http://localhost:4000` via `nuxt.config.ts`.

## Database migrations & schema

The schema lives under `frontend/server/database/schema.ts` and is the source of truth for Drizzle. Regenerate migration files and apply them with:

```bash
cd frontend
npm run db:generate   # re-emit SQL based on the schema
npm run db:migrate    # apply the SQL to the configured database
```

Drizzle Kit requires either `better-sqlite3` or `@libsql/client` to connect to SQLite. Install one of them before running migrations (`npm --workspace=frontend install better-sqlite3` or `npm --workspace=frontend install @libsql/client`). To target MariaDB (production), set `DRIZZLE_DIALECT=mysql`, `DB_DIALECT=mysql`, and provide `DATABASE_URL_MARIA=mysql://user:password@host/database`; the same commands will emit MariaDB-compatible SQL.

Key environment variables for migrations:

- `DATABASE_URL`: SQLite URL for the dev database (default `file:./.data/dev.db`)
- `DATABASE_URL_MARIA`: MariaDB DSN (used when `DRIZZLE_DIALECT=mysql`)
- `DRIZZLE_OUT`: output directory for generated migrations (`./server/database/migrations` by default)
- `DRIZZLE_DIALECT` / `DB_DIALECT`: choose `sqlite` or `mysql` for local vs. production

After running migrations locally, seed the SQLite database with sample organizations, users and memberships:

```bash
cd frontend
npm run seed
```

### Backfill owners after deploying the new schema

The admin refactor innebär att varje organisation måste ha minst en `owner`. Efter att du har kört migreringen `0002_admin_org_model.sql` i staging/produktion behöver du säkerställa detta. Ett enkelt sätt är att återanvända den första superadmin-användaren och koppla hen som temporär ägare på de organisationer som saknar owner:

```bash
cd frontend
npm run db:backfill-owners
```

Kommandot läser databasen via Drizzle, letar efter den första användaren med `is_super_admin = 1` och värmer upp `organization_memberships` med ett `role='owner'` för varje organisation som saknar aktiva owners. Scriptet körs idempotent och skriver en loggrad per uppdaterad organisation.

### SSO rollout checklist

1. Sätt `require_sso` och `allow_self_signup` per organisation via admin-gränssnittet (`/admin/organizations/[slug]/auth`).  
2. Om `require_sso` är aktivt blockeras lokal inloggning för alla användare utom:
   - Superadmins
   - Ägare när `allow_local_login_for_owners` är på. Dessa får en gul banner som påminner om att SSO egentligen krävs.  
3. För övriga användare returnerar `/api/auth/switch-org` HTTP 409 med instruktion att starta SSO-flödet (`/api/auth/sso/[slug]/init`). Standardlayouten visar samma fel längst upp.  
4. Lägg till IdP-uppgifter i `organization_auth_settings` (via Auth-fliken) när integrationen mot SAML/OIDC är klar. Konfigurationen sparas som JSON via `stringifyIdpConfig`/`serializeAuthSettings`.

### Superadmin & onboarding

- Configure whether self-service sign-up is allowed via `AUTH_ALLOW_SELF_REGISTRATION` (default `false`).  
- When running `npm run seed`, the script reads `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` and `SEED_SUPERADMIN_NAME` to create the first superadmin user (all defaults are defined in `env.example`).  
- Sign in with the seeded credentials and open **Admin → Organisationer** to create production organizations and assign owner accounts. Passwords can be generated automatically per organization insert if omitted.

### Administrera medlemmar och organisationer

- På sidan **Admin → Organisationer → [slug] → Medlemmar** går det nu att inaktivera/aktivera konton via PATCH `/api/admin/organizations/:orgId/members/:memberId/status` och radera dem permanent med DELETE `/remove`. Inaktiverade användare kan inte logga in förrän de aktiveras igen, men deras historik ligger kvar.
- Hela organisationer kan tas bort från **Admin → Organisationer → [slug] → Overview**. Danger zone-sektionen kräver att sluggen skrivs in exakt samt att en checkbox markeras; servern dubbelkontrollerar `confirmSlug` och `acknowledgeImpact` innan `organizations`-raden raderas (kaskad). Efter radering skickas admin tillbaka till listan med en bekräftelsebanner.

### Återställning av lösenord och profil

- Slutanvändare kan begära en återställningslänk på `/forgot-password`. En textfil i `uploads/outbox` simulerar mejlet och innehåller länken till `/reset-password?token=...`.
- När länken används sparas ett nytt lösenord och användaren loggas in direkt. Token lagras hashad i databasen och gäller i 30 minuter.
- När användaren klickar på sitt konto i topbaren öppnas `/profile` som visar kontouppgifter, medlemskap och ett formulär för att byta lösenord efter att man har loggat in.
- Admin kan fortfarande flagga `forcePasswordReset` (t.ex. via seeds eller API); användaren ser då en banner på profilsidan tills ett nytt lösenord sparats.
- Superadmins har dessutom en global vy under **Admin → Användare** där de kan söka, inaktivera/aktivera eller ta bort konton samt trigga lösenordsmejl. API:erna exponeras under `/api/admin/users/**`.

### E-postprovider & branding

- Lägg till `EMAIL_CRYPTO_KEY` i `.env` (32 byte i base64/hex) och `INVITE_ACCEPT_BASE_URL` om portalen ligger på annan domän. Samma nyckel används av både Express-backenden och Nuxt-servern för att kryptera leverantörs-secrets.
- `PORTAL_BASE_URL` och `NUXT_PUBLIC_APP_URL` styr vilka länkar som genereras i e-postmallarna. Använd `PASSWORD_RESET_BASE_URL` och `INVITE_ACCEPT_BASE_URL` om återställnings- respektive inbjudningslänkar ska gå via annan domän eller port.
- Sätt `UPLOADS_DIR` om outbox-filerna (förhandsvisning av mail vid fel/lokalt läge) ska skrivas någon annanstans än `./uploads`.
- Globala inställningar hittas under **Admin → Global e-post** (`/admin/settings/email`). Här kan du:
  - Välja mellan SMTP och Microsoft Graph.
  - Ange avsändarnamn, reply-to och valfri branding (logotyp, färger, footertext).
  - Skicka testmail. Misslyckade tester sparas automatiskt tillsammans med felmeddelande.
- Per-organisation overrides finns under **Admin → Organisationer → [slug] → E-post**. När togglen “Använd organisationsspecifik e-postprovider” är avstängd används alltid den globala profilen.
- Om inga providers är aktiva skriver systemet fortfarande ut mallarna till `uploads/outbox` så att utvecklare kan verifiera innehållet.
- All gemensam funktionalitet (kryptering, transport, mallar) bor i `packages/email-kit`.

### Tester

- Kör de nya enhetstesterna för payload-hanteringen med `npm run test:unit --workspace frontend -- frontend/tests/server/email-provider.spec.ts`.

## Next Steps

- Replace mock data in `backend/src/data/mockData.ts` with real connector calls (Cloudflare, Incus, ESXi, WordPress).
- Implement authentication against your IdP and update `tenantContext` middleware.
- Connect the frontend Pinia stores to live endpoints and add optimistic UI updates/tests.

