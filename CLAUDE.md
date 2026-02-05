# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant SaaS portal for managing cloud resources (Cloudflare, Windows DNS, ESXi/Morpheus). Full-stack TypeScript monorepo with Nuxt 4 and Nitro server.

## Commands

### Development
```bash
# Start dev server (runs on localhost:3000)
npm run dev

# Or from portal directory:
cd portal && npm run dev
```

### Setup & Database
```bash
# Initial setup (installs dependencies, initializes database, seeds user)
npm run setup

# Or manually:
cd portal
npm run db:push       # Push schema to database (creates tables)
npm run db:generate   # Generate SQL migrations from schema
npm run db:migrate    # Apply migrations
npm run db:studio     # Open Drizzle Studio UI
npm run seed:user     # Seed test user (auto-runs db:push if needed)
```

### Testing & Linting
```bash
cd portal
npm run test:unit     # Run vitest tests
npm run lint          # ESLint
```

### Build
```bash
npm run build
# Or: cd portal && npm run build
```

### Code Generation (runs automatically on dev/build)
```bash
cd portal
npm run generate:rbac-types   # Generate RBAC TypeScript types
npm run generate:openapi      # Generate OpenAPI specs
```

## Architecture

### Directory Structure
- `portal/` - Nuxt 4 full-stack app (Vue 3, Tailwind, Pinia, Nitro server)
- `packages/email-kit/` - Shared email package with outbox pattern

### Portal Key Locations
- `portal/app/pages/` - File-based routing
- `portal/app/components/` - Vue components (admin, dashboard, dns, email, layout, navigation, operations, organization, security, shared)
- `portal/app/composables/` - Vue composables (auth, permissions, API client)
- `portal/app/stores/` - Pinia stores (containers, dns, monitoring, vms, wordpress)
- `portal/server/api/` - Nitro server routes (H3)
- `portal/server/database/schema.ts` - Drizzle ORM schema (MySQL)
- `portal/layers/` - Plugin layers (cloudflare-dns, windows-dns, windows-dns-redirects)

### Authentication Flow
1. Login: `POST /api/auth/login` -> JWT in HTTP-only cookie
2. Session validated on each request via Nitro middleware
3. Multi-tenant with organization context switching

### Authorization (RBAC)
- Organization roles: `owner`, `admin`, `operator`, `member`, `viewer`, `support`
- MSP tenant roles: `msp-global-admin`, `msp-cloudflare-admin`, etc.
- Permissions defined in `portal/app/constants/rbac.ts`
- Frontend: `usePermission()` composable
- Server: `requirePermission(event, permission, orgId?)` in Nitro routes

### Plugin System
Plugins use Nuxt layers in `portal/layers/`. Each layer has its own pages, components, server routes, and locales. Registry in `portal/layers/plugin-manifests.ts`, synced to database via `portal/server/plugins/plugin-registry-sync.ts`.

### Database
- **MySQL/MariaDB** via Drizzle ORM (`drizzle-orm/mysql-core`)
- Connection: `mysql2/promise` pool via `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`
- Schema: `portal/server/database/schema.ts`
- Upsert pattern: `.onDuplicateKeyUpdate()` (MySQL syntax)
- Transactions: `await db.transaction(async (tx) => { await tx.insert(...) })`
- ID generation: CUID2

## Patterns

### API Routes
- All routes use H3 (`defineEventHandler`) in Nitro
- Use Zod for input validation (`portal/server/validation/`)
- Auth: `requirePermission(event, 'permission:scope', orgId?)`
- Super admin: `requireSuperAdmin(event)`

### Multi-tenant Context
- `organization_memberships` links users to orgs with roles
- Context switch via `POST /api/auth/context-switch`
- Auth state cached in session with tenant context

### Logging
- Custom logger in `server/utils/logger.ts` with request ID tracking
- Automatic redaction of sensitive data (tokens, passwords, secrets)

## Tech Stack
- **Framework:** Nuxt 4.2, Vue 3.5, TypeScript 5.6
- **Server:** Nitro (H3)
- **Styling:** Tailwind 3.4
- **State:** Pinia
- **i18n:** @nuxtjs/i18n
- **Database:** Drizzle ORM 0.44 with MySQL/MariaDB
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Validation:** Zod

## Environment Variables

Key variables (see `env.example`):
- `DB_HOST` - MySQL server hostname or IP
- `DB_PORT` - MySQL port (default: 3306)
- `DB_USER` - MySQL user (default: root)
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name
- `AUTH_JWT_SECRET` - JWT signing secret (min 32 chars in production)
- `AUTH_SERVICE_TOKEN` - Service token for internal calls
- `CLOUDFLARE_TOKEN` - Cloudflare API token
