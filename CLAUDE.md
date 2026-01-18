# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant SaaS portal for managing cloud resources (Cloudflare, Incus, ESXi/Morpheus, WordPress). Full-stack TypeScript monorepo with Nuxt 4 frontend and Express backend.

## Commands

### Development (requires two terminals)
```bash
# Terminal 1 - Backend API (runs on localhost:4000)
cd backend && npm run dev

# Terminal 2 - Frontend (runs on localhost:3000, proxies /api to backend)
cd frontend && npm run dev
```

### Database
```bash
cd frontend
npm run db:generate   # Generate SQL from schema
npm run db:migrate    # Apply migrations
npm run db:studio     # Open Drizzle Studio UI
npm run seed:user     # Seed test user
```

### Testing & Linting
```bash
cd frontend
npm run test:unit     # Run vitest tests
npm run lint          # ESLint
```

### Build
```bash
cd frontend && npm run build
cd backend && npm run build
```

### Code Generation (runs automatically on dev/build)
```bash
cd frontend
npm run generate:rbac-types   # Generate RBAC TypeScript types
npm run generate:openapi      # Generate OpenAPI specs
```

## Architecture

### Directory Structure
- `frontend/` - Nuxt 4 full-stack app (Vue 3, Tailwind, Pinia)
- `backend/` - Express API gateway (validates requests via introspection)
- `packages/email-kit/` - Shared email package with outbox pattern

### Frontend Key Locations
- `frontend/app/pages/` - File-based routing
- `frontend/app/components/` - Vue components (admin, dashboard, dns, email, layout, navigation, operations, organization, security, shared)
- `frontend/app/composables/` - Vue composables (auth, permissions, API client)
- `frontend/app/stores/` - Pinia stores (containers, dns, monitoring, vms, wordpress)
- `frontend/server/api/` - Nuxt server routes (H3)
- `frontend/server/database/schema.ts` - Drizzle ORM schema
- `frontend/layers/` - Plugin layers (cloudflare-dns, windows-dns)

### Backend Key Locations
- `backend/src/server.ts` - Express server entry
- `backend/src/routes/` - API route handlers
- `backend/src/middleware/context.ts` - Auth introspection and tenant context

### Authentication Flow
1. Frontend login: `POST /api/auth/login` → JWT in HTTP-only cookie
2. Backend validates via introspection endpoint with caching (30s TTL)
3. Multi-tenant with organization context switching

### Authorization (RBAC)
- Organization roles: `owner`, `admin`, `operator`, `member`, `viewer`, `support`
- MSP tenant roles: `msp-global-admin`, `msp-cloudflare-admin`, etc.
- Permissions defined in `frontend/app/constants/rbac.ts`
- Frontend: `usePermission()` composable
- Backend: `tenantContext` middleware checks `userContext.permissions`

### Plugin System
Plugins use Nuxt layers in `frontend/layers/`. Each layer has its own pages, components, and locales. Registry in `frontend/layers/plugin-manifests.ts`, synced to database via `frontend/server/plugins/plugin-registry-sync.ts`.

### Database
- SQLite (dev) / MySQL (prod) via Drizzle ORM
- Schema: `frontend/server/database/schema.ts`
- Migrations: `frontend/server/database/migrations/`
- ID generation: CUID2

## Patterns

### API Routes
- Frontend Nuxt routes use H3 (`defineEventHandler`)
- Backend Express routes validate auth via introspection before processing
- Both use Zod for input validation (`frontend/server/validation/`)

### Multi-tenant Context
- `organization_memberships` links users to orgs with roles
- Context switch via `POST /api/auth/context-switch`
- Backend caches user context with inflight deduplication

### Logging
- Custom logger in `server/utils/logger.ts` with request ID tracking
- Automatic redaction of sensitive data (tokens, passwords, secrets)

## Tech Stack
- **Frontend:** Nuxt 4.2, Vue 3.5, TypeScript 5.6, Tailwind 3.4, Pinia, @nuxtjs/i18n
- **Backend:** Express 4.19, TypeScript, Helmet, express-rate-limit
- **Database:** Drizzle ORM 0.44 with SQLite/MySQL
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Validation:** Zod

## Environment Variables

Key variables (see `env.example`):
- `AUTH_JWT_SECRET` - JWT signing secret (min 32 chars in production)
- `AUTH_SERVICE_TOKEN` - Service token for backend introspection
- `DRIZZLE_DIALECT` - `sqlite` or `mysql`
- `DATABASE_URL` - SQLite connection string
- `CLOUDFLARE_TOKEN`, `WORDPRESS_TOKEN` - External API tokens
