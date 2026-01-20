# Cloud Customer Portal

Multi-tenant portal för hantering av Cloudflare, Incus, ESXi/Morpheus och WordPress-resurser.

## Struktur

```
frontend/   Nuxt 4 + Tailwind + Pinia SPA/SSR hybrid
backend/    Node (Express + TypeScript) API gateway
```

## Kom igång lokalt

1. **Installera Node.js 24 LTS**

   Ladda ner och installera Node.js 24 LTS från [nodejs.org](https://nodejs.org/).

2. **Installera dependencies och setup**

```bash
# Installera alla dependencies (root, frontend, backend)
npm run install:all

# Eller manuellt:
cd frontend && npm install
cd ../backend && npm install
```

3. **Installera better-sqlite3 separat**

   `better-sqlite3` finns inte tillgängligt för Node.js 24 LTS via npm, så installera det separat:

```bash
cd frontend
npm install better-sqlite3

cd ../backend
npm install better-sqlite3
```

4. **Konfigurera miljövariabler**

```bash
cp env.example .env.local
```

5. **Initialisera databas och seed användare**

```bash
# Enkelt sätt - gör allt automatiskt:
npm run setup

# Eller manuellt:
cd frontend
npm run db:push    # Skapar databastabellerna
npm run seed:user  # Skapar superadmin-användare
```

**Notera:** `seed:user` kommer automatiskt att köra `db:push` om tabellerna saknas, så du kan hoppa över det steget om du vill.

6. **Starta utvecklingsservrar**

```bash
# Terminal 1 – API
cd backend
npm run dev

# Terminal 2 – Nuxt frontend
cd frontend
npm run dev
```

Nuxt proxar `/api/*` requests till `http://localhost:4000` via `nuxt.config.ts`.

## Databas

Schemat finns i `frontend/server/database/schema.ts`. För att generera och applicera migrationer:

```bash
cd frontend
npm run db:generate   # generera SQL från schema
npm run db:migrate    # applicera SQL till databasen
```
