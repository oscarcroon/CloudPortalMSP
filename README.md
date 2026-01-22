# Cloud Customer Portal

Multi-tenant portal för hantering av Cloudflare, Incus, ESXi/Morpheus och WordPress-resurser.

## Krav

**Rekommenderat: Node.js 22 LTS**

Applikationen fungerar med Node.js 22 LTS. Detta är den rekommenderade versionen för minst bekymmer.

**Node.js 24 LTS (känd bugg)**

Om du kör Node.js 24 LTS finns det en känd bugg i `better-sqlite3` som gör att du behöver paketera och installera `better-sqlite3` manuellt. Detta kan vara komplicerat, så vi rekommenderar att använda Node.js 22 LTS istället.

## Kom igång

### 1. Installera dependencies

```bash
npm run install:all
```

### 2. Konfigurera miljövariabler

```bash
cp env.example .env.local
```

### 3. Initialisera databas och skapa användare

```bash
npm run setup
```

Detta skapar databastabellerna och en superadmin-användare automatiskt.

### 4. Starta utvecklingsserver

```bash
npm run dev
```

Applikationen körs på `http://localhost:3000`.

## Projektstruktur

```
portal/     Nuxt 4 fullstack (Nitro server + Tailwind + Pinia)
packages/   Delade paket (email-kit)
```

## Databas

Schemat finns i `portal/server/database/schema.ts`. För att generera och applicera migrationer:

```bash
cd portal
npm run db:generate   # generera SQL från schema
npm run db:migrate    # applicera SQL till databasen
```
