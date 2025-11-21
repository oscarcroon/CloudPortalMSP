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

### Superadmin & onboarding

- Configure whether self-service sign-up is allowed via `AUTH_ALLOW_SELF_REGISTRATION` (default `false`).  
- When running `npm run seed`, the script reads `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` and `SEED_SUPERADMIN_NAME` to create the first superadmin user (all defaults are defined in `env.example`).  
- Sign in with the seeded credentials and open **Admin → Organisationer** to create production organizations and assign owner accounts. Passwords can be generated automatically per organization insert if omitted.

## Next Steps

- Replace mock data in `backend/src/data/mockData.ts` with real connector calls (Cloudflare, Incus, ESXi, WordPress).
- Implement authentication against your IdP and update `tenantContext` middleware.
- Connect the frontend Pinia stores to live endpoints and add optimistic UI updates/tests.

