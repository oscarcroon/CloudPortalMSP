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

2. **Installera dependencies**

```bash
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

5. **Seed användare**

```bash
cd frontend
npm run seed:user
```

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
