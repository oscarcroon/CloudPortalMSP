# CI/CD Setup Guide - CloudPortal MSP

Denna guide beskriver steg för steg hur du sätter upp GitHub Actions CI/CD för CloudPortal MSP.

## Innehållsförteckning

1. [Översikt](#översikt)
2. [Förutsättningar](#förutsättningar)
3. [Del 1: Förbered applikationsservrarna](#del-1-förbered-applikationsservrarna)
4. [Del 2: Generera SSH-nycklar för deployment](#del-2-generera-ssh-nycklar-för-deployment)
5. [Del 3: Konfigurera GitHub Repository](#del-3-konfigurera-github-repository)
6. [Del 4: Konfigurera databas](#del-4-konfigurera-databas)
7. [Del 5: Konfigurera Traefik](#del-5-konfigurera-traefik)
8. [Del 6: Första deployment](#del-6-första-deployment)
9. [Del 7: Verifiering](#del-7-verifiering)
10. [Felsökning](#felsökning)
11. [Rollback-procedur](#rollback-procedur)

---

## Översikt

### Arkitektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                           INTERNET                                   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DMZ-NÄTVERK                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      TRAEFIK                                 │    │
│  │  - SSL/TLS termination (Let's Encrypt)                      │    │
│  │  - Reverse proxy                                            │    │
│  │  - Load balancing                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│      DEV-SERVER             │   │      PROD-SERVER            │
│      Ubuntu 24.04 LTS       │   │      Ubuntu 24.04 LTS       │
│                             │   │                             │
│  /opt/cloudportal/          │   │  /opt/cloudportal/          │
│  ├── current/ → releases/x  │   │  ├── current/ → releases/x  │
│  ├── releases/              │   │  ├── releases/              │
│  └── shared/                │   │  └── shared/                │
│      └── .env               │   │      └── .env               │
│                             │   │                             │
│  Port: 3000                 │   │  Port: 3000                 │
└──────────────┬──────────────┘   └──────────────┬──────────────┘
               │                                  │
               └──────────────┬───────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MARIADB GALERA CLUSTER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Node 1    │  │   Node 2    │  │   Node 3    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                      │
│  Databaser:                                                          │
│  - cloudportal_dev                                                   │
│  - cloudportal_prod                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Deployment-flöde

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Developer   │────▶│   GitHub     │────▶│   GitHub     │
│  git push    │     │   Repository │     │   Actions    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌────────────────────────────┴────────────────────────────┐
                     │                                                         │
                     ▼                                                         ▼
            ┌─────────────────┐                                     ┌─────────────────┐
            │  push till dev  │                                     │ push till main  │
            │                 │                                     │                 │
            │  Automatisk     │                                     │  Kräver         │
            │  deploy         │                                     │  godkännande    │
            └────────┬────────┘                                     └────────┬────────┘
                     │                                                       │
                     ▼                                                       ▼
            ┌─────────────────┐                                     ┌─────────────────┐
            │   DEV-SERVER    │                                     │   PROD-SERVER   │
            └─────────────────┘                                     └─────────────────┘
```

---

## Förutsättningar

Innan du börjar, säkerställ att du har:

- [ ] Två Ubuntu 24.04 LTS-servrar (dev och prod) med SSH-åtkomst
- [ ] MariaDB Galera Cluster uppsatt och tillgängligt
- [ ] Traefik uppsatt i DMZ
- [ ] DNS-poster konfigurerade (t.ex. `dev.portal.example.com` och `portal.example.com`)
- [ ] GitHub-repository med admin-rättigheter
- [ ] Lokal dator med SSH-klient för att generera nycklar

### Serverinformation

| Server | Användning | Exempel-hostname | Intern IP |
|--------|------------|------------------|-----------|
| DEV-SERVER | Development | `dev-app.internal` | `10.0.1.10` |
| PROD-SERVER | Production | `prod-app.internal` | `10.0.1.20` |
| TRAEFIK | Reverse Proxy | `traefik.dmz.internal` | `10.0.0.5` |
| GALERA-VIP | Database | `galera-vip.internal` | `10.0.2.100` |

> **OBS:** Ersätt alla exempel-hostnames och IP-adresser med dina faktiska värden.

---

## Del 1: Förbered applikationsservrarna

Utför följande steg på **både DEV-SERVER och PROD-SERVER** om inget annat anges.

### 1.1 Uppdatera systemet

**[DEV-SERVER]**
```bash
sudo apt update && sudo apt upgrade -y
```

**[PROD-SERVER]**
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Installera nödvändiga paket

**[DEV-SERVER]**
```bash
sudo apt install -y curl wget git build-essential
```

**[PROD-SERVER]**
```bash
sudo apt install -y curl wget git build-essential
```

### 1.3 Installera Node.js 20 LTS

**[DEV-SERVER]**
```bash
# Lägg till NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Installera Node.js
sudo apt install -y nodejs

# Verifiera installation
node --version
# Förväntat: v20.x.x

npm --version
# Förväntat: 10.x.x
```

**[PROD-SERVER]**
```bash
# Lägg till NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Installera Node.js
sudo apt install -y nodejs

# Verifiera installation
node --version
npm --version
```

### 1.4 Installera pnpm globalt

**[DEV-SERVER]**
```bash
sudo npm install -g pnpm

# Verifiera
pnpm --version
# Förväntat: 9.x.x
```

**[PROD-SERVER]**
```bash
sudo npm install -g pnpm

# Verifiera
pnpm --version
```

### 1.5 Skapa applikationsanvändare

**[DEV-SERVER]**
```bash
# Skapa användare utan lösenord (endast SSH-nyckel-autentisering)
sudo useradd -m -s /bin/bash cloudportal

# Verifiera att användaren skapades
id cloudportal
# Förväntat: uid=1001(cloudportal) gid=1001(cloudportal) groups=1001(cloudportal)
```

**[PROD-SERVER]**
```bash
sudo useradd -m -s /bin/bash cloudportal
id cloudportal
```

### 1.6 Skapa katalogstruktur

**[DEV-SERVER]**
```bash
# Skapa huvudkatalogen
sudo mkdir -p /opt/cloudportal

# Skapa underkatalogerna
sudo mkdir -p /opt/cloudportal/current
sudo mkdir -p /opt/cloudportal/releases
sudo mkdir -p /opt/cloudportal/shared
sudo mkdir -p /opt/cloudportal/shared/logs

# Sätt rättigheter
sudo chown -R cloudportal:cloudportal /opt/cloudportal

# Verifiera strukturen
ls -la /opt/cloudportal/
# Förväntat:
# drwxr-xr-x cloudportal cloudportal current
# drwxr-xr-x cloudportal cloudportal releases
# drwxr-xr-x cloudportal cloudportal shared
```

**[PROD-SERVER]**
```bash
sudo mkdir -p /opt/cloudportal
sudo mkdir -p /opt/cloudportal/current
sudo mkdir -p /opt/cloudportal/releases
sudo mkdir -p /opt/cloudportal/shared
sudo mkdir -p /opt/cloudportal/shared/logs
sudo chown -R cloudportal:cloudportal /opt/cloudportal
ls -la /opt/cloudportal/
```

### 1.7 Konfigurera SSH för cloudportal-användaren

**[DEV-SERVER]**
```bash
# Skapa .ssh-katalogen
sudo -u cloudportal mkdir -p /home/cloudportal/.ssh

# Sätt korrekta rättigheter
sudo chmod 700 /home/cloudportal/.ssh

# Skapa authorized_keys-filen (vi lägger till nycklar i Del 2)
sudo -u cloudportal touch /home/cloudportal/.ssh/authorized_keys
sudo chmod 600 /home/cloudportal/.ssh/authorized_keys

# Verifiera
ls -la /home/cloudportal/.ssh/
# Förväntat:
# -rw------- cloudportal cloudportal authorized_keys
```

**[PROD-SERVER]**
```bash
sudo -u cloudportal mkdir -p /home/cloudportal/.ssh
sudo chmod 700 /home/cloudportal/.ssh
sudo -u cloudportal touch /home/cloudportal/.ssh/authorized_keys
sudo chmod 600 /home/cloudportal/.ssh/authorized_keys
ls -la /home/cloudportal/.ssh/
```

### 1.8 Skapa miljövariabelfil (.env)

**[DEV-SERVER]**
```bash
# Skapa .env-filen
sudo -u cloudportal nano /opt/cloudportal/shared/.env
```

Lägg till följande innehåll (anpassa värdena):

```env
# Application
NODE_ENV=development
NUXT_PUBLIC_APP_URL=https://dev.portal.example.com

# Database (MariaDB Galera Cluster)
DB_HOST=galera-vip.internal
DB_PORT=3306
DB_USER=cloudportal_dev
DB_PASSWORD=ÄNDRA_TILL_SÄKERT_LÖSENORD
DB_NAME=cloudportal_dev

# Authentication
# Generera med: openssl rand -base64 32
AUTH_JWT_SECRET=ÄNDRA_TILL_MINST_32_TECKEN_HEMLIGHET
AUTH_SERVICE_TOKEN=ÄNDRA_TILL_MINST_16_TECKEN_TOKEN

# Cloudflare (om tillämpligt)
CLOUDFLARE_TOKEN=din_cloudflare_api_token
CLOUDFLARE_CRYPTO_KEY=GENERERA_32_BYTE_BASE64_KEY

# Email
EMAIL_CRYPTO_KEY=GENERERA_32_BYTE_BASE64_KEY

# Traefik integration
TRAEFIK_DOMAINS_ENABLED=false
```

Spara filen (Ctrl+X, Y, Enter).

```bash
# Sätt korrekta rättigheter (endast läsbar av cloudportal)
sudo chmod 600 /opt/cloudportal/shared/.env
sudo chown cloudportal:cloudportal /opt/cloudportal/shared/.env

# Verifiera
ls -la /opt/cloudportal/shared/.env
# Förväntat: -rw------- cloudportal cloudportal .env
```

**[PROD-SERVER]**
```bash
sudo -u cloudportal nano /opt/cloudportal/shared/.env
```

Lägg till följande innehåll (anpassa värdena):

```env
# Application
NODE_ENV=production
NUXT_PUBLIC_APP_URL=https://portal.example.com

# Database (MariaDB Galera Cluster)
DB_HOST=galera-vip.internal
DB_PORT=3306
DB_USER=cloudportal_prod
DB_PASSWORD=ÄNDRA_TILL_SÄKERT_LÖSENORD
DB_NAME=cloudportal_prod

# Authentication
# Generera med: openssl rand -base64 32
AUTH_JWT_SECRET=ÄNDRA_TILL_MINST_32_TECKEN_HEMLIGHET
AUTH_SERVICE_TOKEN=ÄNDRA_TILL_MINST_16_TECKEN_TOKEN

# Cloudflare (om tillämpligt)
CLOUDFLARE_TOKEN=din_cloudflare_api_token
CLOUDFLARE_CRYPTO_KEY=GENERERA_32_BYTE_BASE64_KEY

# Email
EMAIL_CRYPTO_KEY=GENERERA_32_BYTE_BASE64_KEY

# Traefik integration
TRAEFIK_DOMAINS_ENABLED=true
TRAEFIK_SFTP_HOST=traefik.dmz.internal
TRAEFIK_SFTP_USER=traefik-sync
TRAEFIK_SFTP_KEY_PATH=/opt/cloudportal/shared/.ssh/traefik_sync_key
```

```bash
sudo chmod 600 /opt/cloudportal/shared/.env
sudo chown cloudportal:cloudportal /opt/cloudportal/shared/.env
```

> **Tips:** Generera säkra värden med:
> ```bash
> # För AUTH_JWT_SECRET (32+ tecken)
> openssl rand -base64 32
>
> # För AUTH_SERVICE_TOKEN (16+ tecken)
> openssl rand -base64 16
>
> # För CRYPTO_KEY (32 bytes base64)
> openssl rand -base64 32
> ```

### 1.9 Skapa systemd service

**[DEV-SERVER]**
```bash
sudo nano /etc/systemd/system/cloudportal.service
```

Lägg till följande innehåll:

```ini
[Unit]
Description=CloudPortal MSP - Development
Documentation=https://github.com/your-org/cloudportal-msp
After=network.target

[Service]
Type=simple
User=cloudportal
Group=cloudportal
WorkingDirectory=/opt/cloudportal/current/portal
EnvironmentFile=/opt/cloudportal/shared/.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudportal

# Säkerhetshärdning
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/cloudportal
PrivateTmp=true

# Resurshantering
MemoryMax=1G
CPUQuota=100%

[Install]
WantedBy=multi-user.target
```

```bash
# Ladda om systemd och aktivera tjänsten
sudo systemctl daemon-reload
sudo systemctl enable cloudportal

# Verifiera att tjänsten är registrerad
sudo systemctl status cloudportal
# Förväntat: "cloudportal.service - CloudPortal MSP - Development"
# Status: inactive (dead) - detta är normalt innan första deploy
```

**[PROD-SERVER]**
```bash
sudo nano /etc/systemd/system/cloudportal.service
```

Lägg till följande innehåll (notera ändrad Description):

```ini
[Unit]
Description=CloudPortal MSP - Production
Documentation=https://github.com/your-org/cloudportal-msp
After=network.target

[Service]
Type=simple
User=cloudportal
Group=cloudportal
WorkingDirectory=/opt/cloudportal/current/portal
EnvironmentFile=/opt/cloudportal/shared/.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudportal

# Säkerhetshärdning
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/cloudportal
PrivateTmp=true

# Resurshantering
MemoryMax=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudportal
sudo systemctl status cloudportal
```

### 1.10 Konfigurera sudo för deployment

GitHub Actions behöver kunna starta om tjänsten utan lösenord.

**[DEV-SERVER]**
```bash
sudo visudo -f /etc/sudoers.d/cloudportal
```

Lägg till följande:

```
# Tillåt cloudportal-användaren att hantera cloudportal-tjänsten
cloudportal ALL=(root) NOPASSWD: /bin/systemctl restart cloudportal
cloudportal ALL=(root) NOPASSWD: /bin/systemctl start cloudportal
cloudportal ALL=(root) NOPASSWD: /bin/systemctl stop cloudportal
cloudportal ALL=(root) NOPASSWD: /bin/systemctl status cloudportal
cloudportal ALL=(root) NOPASSWD: /bin/systemctl is-active cloudportal
```

```bash
# Verifiera syntaxen
sudo visudo -c -f /etc/sudoers.d/cloudportal
# Förväntat: "/etc/sudoers.d/cloudportal: parsed OK"

# Testa att det fungerar
sudo -u cloudportal sudo systemctl status cloudportal
```

**[PROD-SERVER]**
```bash
sudo visudo -f /etc/sudoers.d/cloudportal
```

Lägg till samma innehåll som ovan, sedan:

```bash
sudo visudo -c -f /etc/sudoers.d/cloudportal
sudo -u cloudportal sudo systemctl status cloudportal
```

### 1.11 Konfigurera brandvägg (UFW)

**[DEV-SERVER]**
```bash
# Aktivera UFW om det inte redan är aktiverat
sudo ufw status

# Om inaktivt, aktivera det
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Tillåt SSH (viktigt att göra detta INNAN du aktiverar UFW!)
sudo ufw allow ssh

# Tillåt trafik från Traefik (anpassa IP-adressen)
sudo ufw allow from 10.0.0.5 to any port 3000 proto tcp comment 'Traefik to CloudPortal'

# Aktivera UFW
sudo ufw enable

# Verifiera
sudo ufw status verbose
```

**[PROD-SERVER]**
```bash
sudo ufw status
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow from 10.0.0.5 to any port 3000 proto tcp comment 'Traefik to CloudPortal'
sudo ufw enable
sudo ufw status verbose
```

---

## Del 2: Generera SSH-nycklar för deployment

SSH-nycklar används av GitHub Actions för att ansluta till servrarna.

### 2.1 Generera deploy-nycklar

**[LOKAL DATOR]** (din utvecklingsdator)

```bash
# Skapa en katalog för nycklarna
mkdir -p ~/.ssh/cloudportal-deploy
cd ~/.ssh/cloudportal-deploy

# Generera nyckelpar för DEV-servern
ssh-keygen -t ed25519 -C "github-actions-cloudportal-dev" -f cloudportal_dev_deploy -N ""

# Generera nyckelpar för PROD-servern
ssh-keygen -t ed25519 -C "github-actions-cloudportal-prod" -f cloudportal_prod_deploy -N ""

# Verifiera att nycklarna skapades
ls -la
# Förväntat:
# cloudportal_dev_deploy      (privat nyckel för dev)
# cloudportal_dev_deploy.pub  (publik nyckel för dev)
# cloudportal_prod_deploy     (privat nyckel för prod)
# cloudportal_prod_deploy.pub (publik nyckel för prod)
```

### 2.2 Visa och kopiera publika nycklar

**[LOKAL DATOR]**
```bash
# Visa den publika nyckeln för DEV
cat ~/.ssh/cloudportal-deploy/cloudportal_dev_deploy.pub
# Kopiera hela outputen

# Visa den publika nyckeln för PROD
cat ~/.ssh/cloudportal-deploy/cloudportal_prod_deploy.pub
# Kopiera hela outputen
```

### 2.3 Lägg till publika nycklar på servrarna

**[DEV-SERVER]**
```bash
# Öppna authorized_keys för cloudportal-användaren
sudo nano /home/cloudportal/.ssh/authorized_keys
```

Klistra in den publika nyckeln från `cloudportal_dev_deploy.pub` och spara.

```bash
# Verifiera
cat /home/cloudportal/.ssh/authorized_keys
# Ska visa nyckeln som börjar med "ssh-ed25519 AAAA..."
```

**[PROD-SERVER]**
```bash
sudo nano /home/cloudportal/.ssh/authorized_keys
```

Klistra in den publika nyckeln från `cloudportal_prod_deploy.pub` och spara.

```bash
cat /home/cloudportal/.ssh/authorized_keys
```

### 2.4 Testa SSH-anslutning

**[LOKAL DATOR]**
```bash
# Testa anslutning till DEV-servern
ssh -i ~/.ssh/cloudportal-deploy/cloudportal_dev_deploy cloudportal@dev-app.internal

# Om anslutningen lyckas, kör:
whoami
# Förväntat: cloudportal

# Avsluta SSH-sessionen
exit

# Testa anslutning till PROD-servern
ssh -i ~/.ssh/cloudportal-deploy/cloudportal_prod_deploy cloudportal@prod-app.internal
whoami
exit
```

### 2.5 Hämta server-fingeravtryck (known_hosts)

**[LOKAL DATOR]**
```bash
# Hämta fingeravtryck för DEV-servern
ssh-keyscan -H dev-app.internal
# Kopiera hela outputen (alla rader)

# Hämta fingeravtryck för PROD-servern
ssh-keyscan -H prod-app.internal
# Kopiera hela outputen (alla rader)
```

> **OBS:** Spara dessa värden - de behövs för GitHub Secrets i nästa del.

---

## Del 3: Konfigurera GitHub Repository

### 3.1 Skapa GitHub Environments

1. Gå till ditt GitHub-repository
2. Klicka på **Settings** (kugghjulet)
3. I vänstermenyn, klicka på **Environments**
4. Klicka på **New environment**

**Skapa Development Environment:**
- Name: `development`
- Klicka **Configure environment**
- Inga skyddsregler behövs för dev
- Klicka **Save protection rules**

**Skapa Production Environment:**
- Gå tillbaka till Environments och klicka **New environment**
- Name: `production`
- Klicka **Configure environment**
- Under **Deployment protection rules**:
  - ✅ Aktivera **Required reviewers**
  - Lägg till dig själv eller ditt team som reviewers
  - (Valfritt) ✅ Aktivera **Wait timer** och sätt 5 minuter
- Klicka **Save protection rules**

### 3.2 Lägg till Repository Secrets

1. Gå till **Settings** → **Secrets and variables** → **Actions**
2. Klicka på **New repository secret**

Lägg till följande **repository secrets**:

| Secret Name | Värde |
|-------------|-------|
| `SSH_KNOWN_HOSTS_DEV` | Output från `ssh-keyscan -H dev-app.internal` |
| `SSH_KNOWN_HOSTS_PROD` | Output från `ssh-keyscan -H prod-app.internal` |

### 3.3 Lägg till Environment Secrets

**För Development environment:**

1. Gå till **Settings** → **Environments** → **development**
2. Under **Environment secrets**, klicka **Add secret**

Lägg till följande secrets:

| Secret Name | Värde |
|-------------|-------|
| `SSH_PRIVATE_KEY` | Innehållet i `~/.ssh/cloudportal-deploy/cloudportal_dev_deploy` (den privata nyckeln) |
| `SSH_HOST` | `dev-app.internal` (din dev-servers hostname eller IP) |
| `SSH_USER` | `cloudportal` |

**För Production environment:**

1. Gå till **Settings** → **Environments** → **production**
2. Under **Environment secrets**, klicka **Add secret**

| Secret Name | Värde |
|-------------|-------|
| `SSH_PRIVATE_KEY` | Innehållet i `~/.ssh/cloudportal-deploy/cloudportal_prod_deploy` (den privata nyckeln) |
| `SSH_HOST` | `prod-app.internal` (din prod-servers hostname eller IP) |
| `SSH_USER` | `cloudportal` |

> **VIKTIGT:** När du kopierar den privata nyckeln, se till att inkludera HELA innehållet, inklusive:
> ```
> -----BEGIN OPENSSH PRIVATE KEY-----
> ... (nyckeldata) ...
> -----END OPENSSH PRIVATE KEY-----
> ```

### 3.4 Verifiera konfigurationen

Din GitHub-konfiguration ska nu se ut så här:

**Repository Secrets:**
- `SSH_KNOWN_HOSTS_DEV` ✓
- `SSH_KNOWN_HOSTS_PROD` ✓

**Environment: development**
- Secrets: `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER` ✓
- Protection rules: Inga ✓

**Environment: production**
- Secrets: `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER` ✓
- Protection rules: Required reviewers ✓

---

## Del 4: Konfigurera databas

### 4.1 Skapa databaser och användare

**[GALERA-CLUSTER]** (anslut till valfri nod i klustret)

```bash
# Anslut till MariaDB som root
mysql -u root -p
```

```sql
-- Skapa Development-databas
CREATE DATABASE IF NOT EXISTS cloudportal_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Skapa Development-användare
CREATE USER IF NOT EXISTS 'cloudportal_dev'@'%'
  IDENTIFIED BY 'ÄNDRA_TILL_SÄKERT_LÖSENORD';

-- Ge rättigheter till Development-användaren
GRANT ALL PRIVILEGES ON cloudportal_dev.* TO 'cloudportal_dev'@'%';

-- Skapa Production-databas
CREATE DATABASE IF NOT EXISTS cloudportal_prod
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Skapa Production-användare
CREATE USER IF NOT EXISTS 'cloudportal_prod'@'%'
  IDENTIFIED BY 'ÄNDRA_TILL_SÄKERT_LÖSENORD';

-- Ge rättigheter till Production-användaren
GRANT ALL PRIVILEGES ON cloudportal_prod.* TO 'cloudportal_prod'@'%';

-- Verkställ ändringar
FLUSH PRIVILEGES;

-- Verifiera databaserna
SHOW DATABASES LIKE 'cloudportal%';
-- Förväntat:
-- | Database           |
-- | cloudportal_dev    |
-- | cloudportal_prod   |

-- Verifiera användarna
SELECT User, Host FROM mysql.user WHERE User LIKE 'cloudportal%';
-- Förväntat:
-- | User             | Host |
-- | cloudportal_dev  | %    |
-- | cloudportal_prod | %    |

-- Avsluta
EXIT;
```

### 4.2 Testa databasanslutning

**[DEV-SERVER]**
```bash
# Installera MariaDB-klient om den inte finns
sudo apt install -y mariadb-client

# Testa anslutning till dev-databasen
mysql -h galera-vip.internal -u cloudportal_dev -p cloudportal_dev -e "SELECT 1;"
# Ange lösenordet när du blir tillfrågad
# Förväntat: "1"
```

**[PROD-SERVER]**
```bash
sudo apt install -y mariadb-client

mysql -h galera-vip.internal -u cloudportal_prod -p cloudportal_prod -e "SELECT 1;"
```

---

## Del 5: Konfigurera Traefik

### 5.1 Skapa routing-konfiguration för Development

**[TRAEFIK-SERVER]** (i DMZ)
```bash
sudo nano /etc/traefik/dynamic/cloudportal-dev.yml
```

```yaml
http:
  routers:
    cloudportal-dev:
      rule: "Host(`dev.portal.example.com`)"
      service: cloudportal-dev
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - cloudportal-headers

  services:
    cloudportal-dev:
      loadBalancer:
        servers:
          - url: "http://10.0.1.10:3000"
        healthCheck:
          path: /api/health
          interval: "10s"
          timeout: "3s"

  middlewares:
    cloudportal-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: "https"
        customResponseHeaders:
          X-Frame-Options: "SAMEORIGIN"
          X-Content-Type-Options: "nosniff"
          X-XSS-Protection: "1; mode=block"
          Referrer-Policy: "strict-origin-when-cross-origin"
```

### 5.2 Skapa routing-konfiguration för Production

**[TRAEFIK-SERVER]**
```bash
sudo nano /etc/traefik/dynamic/cloudportal-prod.yml
```

```yaml
http:
  routers:
    cloudportal-prod:
      rule: "Host(`portal.example.com`)"
      service: cloudportal-prod
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - cloudportal-headers
        - cloudportal-ratelimit

  services:
    cloudportal-prod:
      loadBalancer:
        servers:
          - url: "http://10.0.1.20:3000"
        healthCheck:
          path: /api/health
          interval: "10s"
          timeout: "3s"

  middlewares:
    cloudportal-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: "https"
        customResponseHeaders:
          X-Frame-Options: "SAMEORIGIN"
          X-Content-Type-Options: "nosniff"
          X-XSS-Protection: "1; mode=block"
          Referrer-Policy: "strict-origin-when-cross-origin"
          Strict-Transport-Security: "max-age=31536000; includeSubDomains"

    cloudportal-ratelimit:
      rateLimit:
        average: 100
        burst: 50
```

### 5.3 Verifiera Traefik-konfiguration

**[TRAEFIK-SERVER]**
```bash
# Kontrollera att konfigurationsfilerna är korrekta
sudo traefik healthcheck --configfile=/etc/traefik/traefik.yml

# Ladda om Traefik (om det kör som service)
sudo systemctl reload traefik

# Eller om Traefik körs i Docker
docker exec traefik traefik healthcheck
```

---

## Del 6: Första deployment

### 6.1 Verifiera att workflow-filer finns

Kontrollera att följande filer finns i ditt repository:

```
.github/
└── workflows/
    ├── ci.yml           # CI pipeline (lint, test, build)
    ├── deploy-dev.yml   # Deploy till development
    └── deploy-prod.yml  # Deploy till production
```

### 6.2 Pusha till dev-branchen

**[LOKAL DATOR]**
```bash
# Se till att du är på dev-branchen
git checkout dev

# Gör en liten ändring (t.ex. uppdatera en kommentar eller version)
# eller bara pusha befintliga ändringar

git add .
git commit -m "Trigger initial deployment"
git push origin dev
```

### 6.3 Övervaka deployment i GitHub Actions

1. Gå till ditt GitHub-repository
2. Klicka på **Actions**-fliken
3. Du ska se två workflows köra:
   - **CI** - kör tester och bygger applikationen
   - **Deploy to Development** - deployar till dev-servern

4. Klicka på **Deploy to Development** för att se detaljerna
5. Vänta tills alla steg är gröna ✅

### 6.4 Initialisera databasen (endast första gången)

Efter första deployment måste du köra databasmigrationer och seeda initial data.

**[DEV-SERVER]**
```bash
# Byt till cloudportal-användaren
sudo -u cloudportal bash

# Gå till applikationskatalogen
cd /opt/cloudportal/current/portal

# Läs in miljövariabler
source /opt/cloudportal/shared/.env

# Kör databasmigrationer
npx drizzle-kit push

# Seeda superadmin-användare (konfigurera SEED_* variabler i .env först om nödvändigt)
node scripts/seed-superadmin.js

# Avsluta cloudportal-shell
exit
```

> **OBS:** Migrationer körs automatiskt vid varje deployment via workflow-filen, men initial seeding måste göras manuellt.

### 6.5 Deploy till Production

1. Skapa en Pull Request från `dev` till `main`
2. Granska och godkänn PR:en
3. Merga PR:en till `main`
4. Gå till **Actions** → **Deploy to Production**
5. Du kommer se att workflow väntar på godkännande
6. Klicka **Review deployments**
7. Välj **production** och klicka **Approve and deploy**
8. Vänta tills deployment är klar

**[PROD-SERVER]** (efter första deployment)
```bash
sudo -u cloudportal bash
cd /opt/cloudportal/current/portal
source /opt/cloudportal/shared/.env
npx drizzle-kit push
node scripts/seed-superadmin.js
exit
```

---

## Del 7: Verifiering

### 7.1 Kontrollera tjänstestatus

**[DEV-SERVER]**
```bash
# Kontrollera att tjänsten körs
sudo systemctl status cloudportal
# Ska visa "active (running)"

# Se de senaste loggarna
sudo journalctl -u cloudportal -n 50 --no-pager

# Följ loggar i realtid
sudo journalctl -u cloudportal -f
```

**[PROD-SERVER]**
```bash
sudo systemctl status cloudportal
sudo journalctl -u cloudportal -n 50 --no-pager
```

### 7.2 Testa health endpoint lokalt

**[DEV-SERVER]**
```bash
curl -s http://localhost:3000/api/health | jq .
# Förväntat output:
# {
#   "status": "healthy",
#   "timestamp": "2024-01-15T12:00:00.000Z",
#   "uptime": 123.456,
#   "version": "unknown",
#   "checks": {
#     "database": {
#       "status": "ok",
#       "latency_ms": 5
#     }
#   },
#   "response_time_ms": 10
# }
```

**[PROD-SERVER]**
```bash
curl -s http://localhost:3000/api/health | jq .
```

### 7.3 Testa via Traefik (extern åtkomst)

**[LOKAL DATOR]**
```bash
# Testa dev-miljön
curl -s https://dev.portal.example.com/api/health | jq .

# Testa prod-miljön
curl -s https://portal.example.com/api/health | jq .
```

### 7.4 Verifiera release-katalogen

**[DEV-SERVER]**
```bash
# Lista releases
ls -la /opt/cloudportal/releases/
# Ska visa release-kataloger med format: YYYYMMDD_HHMMSS_<commit-hash>

# Kontrollera current-symlinken
ls -la /opt/cloudportal/current
# Ska peka på senaste release
```

### 7.5 Checklista för verifiering

| Kontroll | DEV | PROD |
|----------|-----|------|
| `systemctl status cloudportal` visar "active" | ☐ | ☐ |
| Health endpoint svarar med "healthy" | ☐ | ☐ |
| Applikationen nåbar via Traefik | ☐ | ☐ |
| Inloggning fungerar | ☐ | ☐ |
| Databasanslutning fungerar | ☐ | ☐ |

---

## Felsökning

### Problem: SSH-anslutning misslyckas

**Symptom:** GitHub Actions kan inte ansluta till servern.

**Lösning:**
```bash
# [LOKAL DATOR] Verifiera att nyckeln fungerar lokalt
ssh -i ~/.ssh/cloudportal-deploy/cloudportal_dev_deploy -v cloudportal@dev-app.internal

# [DEV-SERVER] Kontrollera SSH-loggar
sudo tail -f /var/log/auth.log

# [DEV-SERVER] Verifiera rättigheter
ls -la /home/cloudportal/.ssh/
# authorized_keys ska vara -rw------- (600)
# .ssh katalogen ska vara drwx------ (700)
```

### Problem: Tjänsten startar inte

**Symptom:** `systemctl status cloudportal` visar "failed".

**Lösning:**
```bash
# [DEV-SERVER] Se detaljerade felmeddelanden
sudo journalctl -u cloudportal -n 100 --no-pager

# Vanliga orsaker:
# 1. .env-filen saknas eller har fel rättigheter
ls -la /opt/cloudportal/shared/.env

# 2. Node.js kan inte hittas
which node
node --version

# 3. Build-filer saknas
ls -la /opt/cloudportal/current/portal/.output/

# 4. Manuellt testa att starta applikationen
sudo -u cloudportal bash
cd /opt/cloudportal/current/portal
source /opt/cloudportal/shared/.env
node .output/server/index.mjs
```

### Problem: Databasanslutning misslyckas

**Symptom:** Health endpoint visar `"database": { "status": "error" }`.

**Lösning:**
```bash
# [DEV-SERVER] Testa manuell anslutning
mysql -h galera-vip.internal -u cloudportal_dev -p cloudportal_dev

# Verifiera miljövariabler
cat /opt/cloudportal/shared/.env | grep DB_

# [GALERA-CLUSTER] Kontrollera att användaren kan ansluta från serverns IP
SELECT User, Host FROM mysql.user WHERE User = 'cloudportal_dev';
```

### Problem: Health check timeout i workflow

**Symptom:** Deploy lyckas men health check misslyckas.

**Lösning:**
```bash
# [DEV-SERVER] Kontrollera att applikationen lyssnar på port 3000
ss -tlnp | grep 3000

# Kontrollera brandväggen
sudo ufw status

# Manuellt testa health endpoint
curl -v http://localhost:3000/api/health
```

### Problem: "Permission denied" vid deployment

**Symptom:** rsync eller ssh-kommandon misslyckas med "Permission denied".

**Lösning:**
```bash
# [DEV-SERVER] Verifiera ägarskap
ls -la /opt/cloudportal/

# Återställ rättigheter om nödvändigt
sudo chown -R cloudportal:cloudportal /opt/cloudportal/

# Verifiera sudoers-konfiguration
sudo cat /etc/sudoers.d/cloudportal
```

---

## Rollback-procedur

Om något går fel efter en deployment kan du snabbt återgå till en tidigare version.

### Manuell rollback

**[DEV-SERVER]** eller **[PROD-SERVER]**
```bash
# 1. Lista tillgängliga releases
ls -la /opt/cloudportal/releases/
# Exempel output:
# 20240115_120000_abc1234
# 20240115_100000_def5678  <- tidigare fungerande version
# 20240114_150000_ghi9012

# 2. Identifiera vilken release som är aktiv
readlink /opt/cloudportal/current
# Visar: /opt/cloudportal/releases/20240115_120000_abc1234

# 3. Byt till tidigare release
sudo -u cloudportal ln -sfn /opt/cloudportal/releases/20240115_100000_def5678 /opt/cloudportal/current

# 4. Starta om tjänsten
sudo systemctl restart cloudportal

# 5. Verifiera att tjänsten körs
sudo systemctl status cloudportal

# 6. Testa health endpoint
curl http://localhost:3000/api/health
```

### Automatisk cleanup

Workflow-filen tar automatiskt bort gamla releases och behåller de 5 senaste. Om du behöver manuellt rensa:

```bash
# [DEV-SERVER]
cd /opt/cloudportal/releases

# Se vilka releases som finns
ls -lt

# Ta bort specifik gammal release
sudo -u cloudportal rm -rf 20240101_120000_old1234
```

---

## Bilaga: Genererade workflow-filer

### .github/workflows/ci.yml

Denna fil kör tester och bygger applikationen vid varje push och pull request.

### .github/workflows/deploy-dev.yml

Denna fil deployar automatiskt till dev-servern vid push till `dev`-branchen.

### .github/workflows/deploy-prod.yml

Denna fil deployar till prod-servern vid push till `main`-branchen, men kräver manuellt godkännande i GitHub.

---

## Sammanfattning

Efter att ha följt denna guide har du:

1. ✅ Två Ubuntu-servrar konfigurerade med Node.js och pnpm
2. ✅ Dedikerad `cloudportal`-användare med rätt behörigheter
3. ✅ Systemd-tjänst för automatisk start och övervakning
4. ✅ SSH-nycklar för säker deployment från GitHub Actions
5. ✅ GitHub Environments med skydd för produktion
6. ✅ CI/CD pipeline som automatiskt testar, bygger och deployar
7. ✅ Health check endpoint för övervakning
8. ✅ Traefik-routing med SSL och säkerhetsheaders
9. ✅ Dokumenterad rollback-procedur

Vid frågor eller problem, kontrollera först [Felsökning](#felsökning)-sektionen.
