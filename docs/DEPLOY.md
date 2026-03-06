# Deploy & Rollback Guide - CloudPortal MSP

Denna guide beskriver hur du deployar nya versioner och rullar tillbaka vid problem.

## Innehållsförteckning

1. [Översikt](#översikt)
2. [Förutsättningar](#förutsättningar)
3. [Deploy ny version](#deploy-ny-version)
4. [Rollback](#rollback)
5. [Felsökning](#felsökning)
6. [Referens: Alla kommandon](#referens-alla-kommandon)

---

## Översikt

Det finns **två sätt** att deploya:

| Metod | När | Kommando |
|-------|-----|----------|
| **CI/CD (GitHub Actions)** | Push till `dev` eller `main` | Automatiskt |
| **Manuellt (deploy.sh)** | Hotfix, nätverksproblem, första setup | `./deploy.sh upgrade` |

Båda metoderna följer samma flöde:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Hämta kod   │────▶│   Bygga      │────▶│   Aktivera   │────▶│ Health check │
│  (git pull)  │     │ (npm build)  │     │  (symlink)   │     │  (curl /api) │
└──────────────┘     └──────────────┘     └──────┬───────┘     └──────┬───────┘
                                                  │                    │
                                                  │                    ├── OK → Klar!
                                                  │                    └── FEL → Auto-rollback
                                                  │
                                         Skapar ny katalog i:
                                         /opt/cloudportal/releases/YYYYMMDD_HHMMSS_<hash>/
```

### Katalogstruktur på servern

```
/opt/cloudportal/
├── current → releases/20260304_143000_abc1234/   (symlink till aktiv release)
├── releases/
│   ├── 20260304_143000_abc1234/                  (senaste)
│   ├── 20260303_100000_def5678/
│   └── 20260302_090000_ghi9012/
├── shared/
│   ├── .env                                      (miljövariabler)
│   └── uploads/                                  (persistent filuppladdning)
└── .build-workspace/                             (temporär, rensas efter bygge)
```

### Branch-strategi

| Server | NODE_ENV | Branch | Deploy-trigger |
|--------|----------|--------|----------------|
| DEV-SERVER | `development` | `dev` | Push till `dev` / manuellt |
| PROD-SERVER | `production` | `main` | Push till `main` + godkännande / manuellt |

`deploy.sh upgrade` detekterar automatiskt rätt branch baserat på `NODE_ENV` i `.env`.

---

## Förutsättningar

Innan du kan köra `deploy.sh` manuellt på servern behöver du:

1. **Servern bootstrappad** - Kör `infra/bootstrap_webhost.sh` (se [CICD-SETUP.md](CICD-SETUP.md))
2. **`.env` konfigurerad** - Kopiera `infra/env.prod.example` till `/opt/cloudportal/shared/.env`
3. **Git-åtkomst** - Servern måste kunna klona repot (HTTPS eller SSH)
4. **Node.js 22** - Installeras av bootstrap-scriptet

### Kopiera deploy.sh till servern

```bash
# Från din lokala dator:
scp infra/deploy.sh cloudportal@prod-app.internal:/opt/cloudportal/deploy.sh

# På servern - gör den körbar:
chmod +x /opt/cloudportal/deploy.sh
```

### Konfigurera git-åtkomst (om privat repo)

Om repot är privat behöver servern autentisering:

```bash
# Alternativ 1: GitHub Personal Access Token (rekommenderat)
# Skapa token: GitHub → Settings → Developer settings → Personal access tokens
# Ge tokenet "repo" scope

# Konfigurera git credential helper (sparar token permanent)
git config --global credential.helper store

# Första gången du kör upgrade kommer git att fråga om credentials.
# Ange ditt GitHub-användarnamn och tokenet som lösenord.
# Tokenet sparas i ~/.git-credentials och återanvänds automatiskt.

# Alternativ 2: SSH-nyckel
# Generera nyckel:
ssh-keygen -t ed25519 -C "deploy@prod-server" -f ~/.ssh/github_deploy
# Lägg till publika nyckeln som Deploy Key i GitHub-repot
# Ändra GIT_REPO i deploy.sh till SSH-URL:
# GIT_REPO="git@github.com:orgiz/CloudPortalMSP.git"
```

---

## Deploy ny version

### Automatiskt via CI/CD (rekommenderat)

**Development:**
```bash
# Pusha till dev-branchen - deploy sker automatiskt
git push origin dev
```

**Production:**
```bash
# 1. Merga till main
git checkout main
git merge dev
git push origin main

# 2. Gå till GitHub → Actions → "Deploy to Production"
# 3. Klicka "Review deployments" → Approve
```

### Manuellt med deploy.sh

SSH:a in till servern och kör:

**Vanligaste: Hämta senaste versionen**
```bash
# Logga in på servern
ssh admin@prod-app.internal

# Kör upgrade (detekterar branch automatiskt från NODE_ENV)
# Production-server → hämtar från 'main'
# Development-server → hämtar från 'dev'
sudo -u cloudportal /opt/cloudportal/deploy.sh upgrade
```

**Specifik branch, tag eller commit:**
```bash
# Deploy från specifik branch
sudo -u cloudportal /opt/cloudportal/deploy.sh upgrade main
sudo -u cloudportal /opt/cloudportal/deploy.sh upgrade dev

# Deploy från en git-tag (t.ex. release)
sudo -u cloudportal /opt/cloudportal/deploy.sh upgrade v1.2.0

# Deploy från en specifik commit
sudo -u cloudportal /opt/cloudportal/deploy.sh upgrade abc1234
```

### Vad händer under upgrade?

```
[STEG] 1/6 Hämtar källkod från git...
  → Klonar repot (shallow clone) till /opt/cloudportal/.build-workspace/
  → Commit: abc1234 - Fix login redirect bug

[STEG] 2/6 Installerar beroenden (npm ci)...
  → Kör npm ci

[STEG] 3/6 Bygger applikationen (npm run build)...
  → Kör npm run build
  → Skapar .output/server/index.mjs (Nitro ESM-bundle)

[STEG] 4/6 Skapar release...
  → /opt/cloudportal/releases/20260304_143000_abc1234/

[STEG] 5/6 Rensar build-workspace...
  → Tar bort .build-workspace/

[STEG] 6/6 Aktiverar release...
  → Symlänkar .env och uploads
  → Kör databasmigrering (drizzle-kit push)
  → Byter symlink: current → ny release
  → Startar om cloudportal.service
  → Väntar på health check (max 60 sekunder)
  → Om health check misslyckas: AUTO-ROLLBACK till föregående release
```

---

## Rollback

### Snabb rollback (föregående version)

```bash
# Rulla tillbaka till den version som körde innan senaste deploy
sudo -u cloudportal /opt/cloudportal/deploy.sh rollback
```

Scriptet gör följande:
1. Identifierar den föregående releasen
2. Byter `current`-symlinken
3. Startar om tjänsten
4. Verifierar med health check

### Rollback till specifik release

```bash
# 1. Lista alla tillgängliga releases
sudo -u cloudportal /opt/cloudportal/deploy.sh list

# Exempel-output:
# Releases i /opt/cloudportal/releases:
# -----------------------------------------------------------
#      RELEASE                                STORLEK
#  --- -------------------------------------- --------
#   -> 20260304_143000_abc1234                 85M
#      20260303_100000_def5678                 84M
#      20260302_090000_ghi9012                 83M
# -----------------------------------------------------------
#   -> = aktiv release
#   Totalt: 3 release(s)

# 2. Rulla tillbaka till specifik release
sudo -u cloudportal /opt/cloudportal/deploy.sh rollback 20260303_100000_def5678

# Du kan också ange bara en del av namnet:
sudo -u cloudportal /opt/cloudportal/deploy.sh rollback def5678
```

### Automatisk rollback

Om en deploy misslyckas (health check svarar inte inom 60 sekunder) rullar scriptet **automatiskt** tillbaka till föregående fungerande release.

```
[FEL]  ========================================
[FEL]  Health check MISSLYCKADES - startar auto-rollback!
[FEL]  ========================================
[WARN] Återställer till: 20260303_100000_def5678
[INFO] Auto-rollback lyckades till: 20260303_100000_def5678
```

### OBS: Databasändringar vid rollback

Rollback byter bara applikationskod. Databasmigrationer körs **framåt** vid deploy men **inte bakåt** vid rollback. Om en deploy inkluderade schemaändringar:

1. Kontrollera att den gamla koden är kompatibel med det nya schemat
2. Vid behov, kör manuell databasåterställning:
   ```bash
   # Anslut till databasen
   mysql -h galera-vip.internal -u cloudportal_prod -p cloudportal_prod

   # Återställ specifika ändringar manuellt
   # (Drizzle-kit har inget automatiskt rollback-kommando)
   ```

---

## Felsökning

### Kontrollera status

```bash
# Hälsostatus (tjänst, release, disk, minne)
sudo -u cloudportal /opt/cloudportal/deploy.sh health

# Tjänstens status
sudo systemctl status cloudportal

# Senaste loggar (standard: 50 rader)
sudo -u cloudportal /opt/cloudportal/deploy.sh logs

# Fler loggar
sudo -u cloudportal /opt/cloudportal/deploy.sh logs 200

# Följ loggar i realtid
sudo journalctl -u cloudportal -f
```

### Tjänsten startar inte

```bash
# 1. Kontrollera loggar
sudo journalctl -u cloudportal -n 100 --no-pager

# 2. Testa manuell start
sudo -u cloudportal bash -c '
  cd /opt/cloudportal/current/portal
  source /opt/cloudportal/shared/.env
  node .output/server/index.mjs
'

# 3. Vanliga orsaker:
#    - .env saknar obligatoriska variabler (AUTH_JWT_SECRET, DB_HOST, etc.)
#    - Databasen är inte nåbar
#    - Port 3000 redan upptagen (ss -tlnp | grep 3000)
#    - Felaktig build (.output/ saknas)
```

### Git clone misslyckas

```bash
# Testa manuellt
git clone --depth 1 --branch main https://github.com/orgiz/CloudPortalMSP.git /tmp/test-clone

# Om autentisering krävs:
#   - Kontrollera att git credentials är konfigurerade
#   - Eller byt till SSH: GIT_REPO i deploy.sh

# Om branch inte finns:
git ls-remote https://github.com/orgiz/CloudPortalMSP.git
```

### Bygget misslyckas

```bash
# Kör bygget manuellt för att se full output
cd /tmp
git clone --depth 1 --branch main https://github.com/orgiz/CloudPortalMSP.git test-build
cd test-build
npm ci
npm run build

# Vanliga orsaker:
#   - Otillräckligt minne (behöver ~1.5GB under bygge)
#   - package-lock.json ur synk (kör npm install utan --frozen-lockfile)
#   - Node.js-version mismatch (behöver v22)
```

### Databasmigrering misslyckas

```bash
# Testa manuell anslutning
mysql -h galera-vip.internal -u cloudportal_prod -p cloudportal_prod -e "SELECT 1;"

# Kör migrering manuellt
cd /opt/cloudportal/current/portal
source /opt/cloudportal/shared/.env
npx drizzle-kit push --force

# Vid fel: kontrollera DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME i .env
```

---

## Referens: Alla kommandon

```
deploy.sh upgrade [ref]              Hämta från git, bygg och deploya
deploy.sh deploy <källa>             Deploya från tarball eller katalog
deploy.sh rollback [release]         Återställ till föregående eller specifik release
deploy.sh list                       Lista alla releases med storlek
deploy.sh health                     Visa tjänstestatus, release, disk, minne
deploy.sh cleanup                    Ta bort gamla releases, behåll 5 senaste
deploy.sh logs [antal]               Visa journald-loggar (standard: 50)
```

### Vanliga arbetsflöden

```bash
# Normal deploy (vanligast)
./deploy.sh upgrade

# Kontrollera att allt fungerar
./deploy.sh health

# Något gick fel? Rulla tillbaka
./deploy.sh rollback

# Kontrollera loggar
./deploy.sh logs 100

# Rensa disk
./deploy.sh cleanup
```

### Konfiguration i scriptet

Redigera toppen av `deploy.sh` om du behöver ändra:

| Variabel | Standard | Beskrivning |
|----------|----------|-------------|
| `APP_DIR` | `/opt/cloudportal` | Applikationskatalog |
| `GIT_REPO` | `https://github.com/orgiz/CloudPortalMSP.git` | Git-repo URL |
| `HEALTH_RETRIES` | `30` | Max antal health check-försök |
| `HEALTH_INTERVAL` | `2` | Sekunder mellan health check-försök |
| `KEEP_RELEASES` | `5` | Antal releases att behålla |
