# Cloud Customer Portal

Multi-tenant portal for hantering av Cloudflare, Windows DNS, Incus, ESXi/Morpheus och WordPress-resurser.

## Krav

- **Node.js 20+** (rekommenderat: Node.js 22 LTS)
- **MySQL/MariaDB** - en tillganglig MySQL- eller MariaDB-server

## Kom igang

### 1. Installera dependencies

**Fran projektets root-mapp:**

```bash
npm run install:all
```

### 2. Konfigurera miljovariabler

Kopiera `env.example` till `portal/.env`:

**Windows (PowerShell/CMD):**
```bash
copy env.example portal\.env
```

**Linux/Mac:**
```bash
cp env.example portal/.env
```

Redigera `portal/.env` och uppdatera minst:

```env
# Databas - obligatorisk
DB_HOST=192.168.7.250
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=cloudpanelmsp

# Sakerhet - obligatorisk i produktion (min 32 tecken)
AUTH_JWT_SECRET=<generera-stark-hemlighet>
AUTH_SERVICE_TOKEN=<generera-stark-token>
```

### 3. Skapa databasen i MySQL

Logga in pa din MySQL/MariaDB-server och skapa databasen:

```sql
CREATE DATABASE IF NOT EXISTS cloudpanelmsp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Om du anvander en dedikerad anvandare (rekommenderat for produktion):

```sql
CREATE USER 'portaluser'@'%' IDENTIFIED BY 'starkt-losenord';
GRANT ALL PRIVILEGES ON cloudpanelmsp.* TO 'portaluser'@'%';
FLUSH PRIVILEGES;
```

Uppdatera sedan `DB_HOST`, `DB_USER`, `DB_PASSWORD` och `DB_NAME` i `portal/.env` med ratt uppgifter.

### 4. Initialisera databas och skapa anvandare

**Fran projektets root-mapp:**

```bash
# Enkelt satt - gor allt automatiskt:
npm run setup
```

**Eller manuellt (fran portal-mappen):**

```bash
cd portal
npm run db:push    # Skapar databastabellerna
npm run seed:user  # Skapar superadmin-anvandare
```

`seed:user` kommer automatiskt att kora `db:push` om tabellerna saknas.

### 5. Starta utvecklingsserver

**Fran projektets root-mapp:**

```bash
npm run dev
```

Applikationen kors pa `http://localhost:3000`.

**Inloggningsuppgifter** (standard):
- Email: `owner@example.com`
- Losenord: `OwnerPass123!`

(Kan andras via `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` i `.env`)

## Projektstruktur

```
portal/     Nuxt 4 fullstack (Nitro server + Tailwind + Pinia)
packages/   Delade paket (email-kit)
```

## Databas

Applikationen anvander **MySQL/MariaDB** via Drizzle ORM.

Schemat finns i `portal/server/database/schema.ts`. For att hantera schemat:

```bash
cd portal
npm run db:push       # Pusha schema till databasen (skapar/uppdaterar tabeller)
npm run db:generate   # Generera SQL-migrationer fran schema
npm run db:migrate    # Applicera SQL-migrationer
npm run db:studio     # Oppna Drizzle Studio (databas-UI)
```

### Miljovariabler for databas

| Variabel | Beskrivning |
|---|---|
| `DB_HOST` | MySQL-server hostname eller IP-adress |
| `DB_PORT` | MySQL-port (standard: `3306`) |
| `DB_USER` | MySQL-anvandare (standard: `root`) |
| `DB_PASSWORD` | MySQL-losenord |
| `DB_NAME` | Databasnamn (t.ex. `cloudpanelmsp`) |
