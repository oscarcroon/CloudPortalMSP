# Cloud Customer Portal

Multi-tenant portal för hantering av Cloudflare, Incus, ESXi/Morpheus och WordPress-resurser.

## Struktur

```
portal/     Nuxt 4 fullstack (Nitro server + Tailwind + Pinia)
packages/   Delade paket (email-kit)
```

## Kom igång lokalt

1. **Installera Node.js 24 LTS**

   Ladda ner och installera Node.js 24 LTS från [nodejs.org](https://nodejs.org/).

2. **Installera dependencies och setup**

```bash
# Installera alla dependencies
npm run install:all

# Eller manuellt:
cd portal && npm install
```

3. **Installera better-sqlite3 separat**

   `better-sqlite3` finns inte tillgängligt för Node.js 24 LTS via npm, så installera det separat:

```bash
cd portal
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
cd portal
npm run db:push    # Skapar databastabellerna
npm run seed:user  # Skapar superadmin-användare
```

**Notera:** `seed:user` kommer automatiskt att köra `db:push` om tabellerna saknas, så du kan hoppa över det steget om du vill.

6. **Starta utvecklingsserver**

```bash
# Från root:
npm run dev

# Eller från portal:
cd portal
npm run dev
```

Applikationen körs på `http://localhost:3000`. Nitro hanterar både frontend och API-routes.

## Databas

Schemat finns i `portal/server/database/schema.ts`. För att generera och applicera migrationer:

```bash
cd portal
npm run db:generate   # generera SQL från schema
npm run db:migrate    # applicera SQL till databasen
```
