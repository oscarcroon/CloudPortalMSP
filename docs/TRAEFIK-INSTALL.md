# Traefik Installation Guide - Ubuntu 24.04 LTS

Denna guide beskriver hur du installerar och konfigurerar Traefik som edge reverse proxy på en ren Ubuntu 24.04 LTS-server. Guiden täcker allt från serverförberedelse till en körande Traefik-instans.

> **Tips: Automatiserat alternativ**
>
> Stegen 1–5 och 9–10 kan köras automatiskt med bootstrap-scriptet:
>
> ```bash
> scp infra/bootstrap_traefik.sh admin@<TRAEFIK-IP>:/tmp/
> nano /tmp/bootstrap_traefik.sh    # Redigera konfigurationssektionen
> sudo bash /tmp/bootstrap_traefik.sh
> ```
>
> Scriptet installerar Docker, skapar kataloger, konfigurerar SFTP-sync-användare, brandvägg, loggrotation **plus** säkerhetshärdning (SSH, fail2ban, kernel sysctl, unattended-upgrades). Se [`infra/bootstrap_traefik.sh`](../infra/bootstrap_traefik.sh) för detaljer.
>
> Efter scriptet behöver du fortfarande kopiera konfigurationsfilerna (steg 5.3–5.5) och starta Traefik (steg 6).

> **Obs:** Denna guide täcker *installation* av Traefik. För konfiguration av routing, custom domains och SFTP-sync, se:
> - [`docs/CICD-SETUP.md` Del 6](CICD-SETUP.md#del-6-konfigurera-traefik) — Routing-konfiguration för dev/prod
> - [`portal/infra/traefik/README.md`](../portal/infra/traefik/README.md) — Custom domains, SFTP-sync, arkitektur

## Innehållsförteckning

1. [Förutsättningar](#1-förutsättningar)
2. [Serverförberedelse](#2-serverförberedelse)
3. [Brandvägg (UFW)](#3-brandvägg-ufw)
4. [Installera Docker](#4-installera-docker)
5. [Förbered Traefik-kataloger och filer](#5-förbered-traefik-kataloger-och-filer)
6. [Starta Traefik](#6-starta-traefik)
7. [Verifiera installation](#7-verifiera-installation)
8. [Skapa initial routing-konfiguration](#8-skapa-initial-routing-konfiguration)
9. [Konfigurera SFTP-sync-användare](#9-konfigurera-sftp-sync-användare)
10. [Loggrotation](#10-loggrotation)
11. [Uppgradera Traefik](#11-uppgradera-traefik)
12. [Nedgradera (rollback)](#12-nedgradera-rollback-traefik-version)
13. [Nästa steg](#13-nästa-steg)

---

## 1. Förutsättningar

- **Ubuntu 24.04 LTS** — ren installation (t.ex. server i DMZ)
- **Publik IP** — DNS-poster (A-post) pekar mot servern
- **Port 80 och 443** — nåbara från internet (brandvägg/NAT konfigurerad)
- **SSH-åtkomst** — som `root` eller användare med `sudo`-rättigheter

---

## 2. Serverförberedelse

### 2.1 Uppdatera systemet

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Sätt hostname och tidszon

```bash
# Sätt hostname (anpassa till ditt servernamn)
sudo hostnamectl set-hostname traefik-edge

# Sätt tidszon
sudo timedatectl set-timezone Europe/Stockholm

# Verifiera
hostnamectl
timedatectl
```

### 2.3 Skapa admin-användare (om du är inloggad som root)

```bash
# Skapa användare
adduser admin

# Ge sudo-rättigheter
usermod -aG sudo admin

# Kopiera SSH-nycklar (om du använder nyckelbaserad inloggning)
rsync --archive --chown=admin:admin ~/.ssh /home/admin

# Logga in som den nya användaren
su - admin
```

---

## 3. Brandvägg (UFW)

### 3.1 Installera och konfigurera UFW

```bash
# Installera UFW (oftast redan installerad)
sudo apt install -y ufw

# Neka all inkommande trafik som standard
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Tillåt SSH (viktigt: gör detta INNAN du aktiverar UFW)
sudo ufw allow 22/tcp

# Tillåt HTTP och HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Aktivera brandväggen
sudo ufw enable

# Verifiera regler
sudo ufw status verbose
```

Förväntad output:

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

---

## 4. Installera Docker

> **Viktigt:** Installera Docker CE från Dockers officiella apt-repository — inte Ubuntus snap- eller apt-paket (`docker.io`).

### 4.1 Installera beroenden

```bash
sudo apt install -y ca-certificates curl gnupg
```

### 4.2 Lägg till Dockers GPG-nyckel och repository

```bash
# Lägg till Dockers officiella GPG-nyckel
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Lägg till Docker-repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 4.3 Installera Docker CE

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 4.4 Efterinstallation

```bash
# Lägg till din användare i docker-gruppen (så du slipper sudo)
sudo usermod -aG docker $USER

# Aktivera Docker vid uppstart
sudo systemctl enable docker
sudo systemctl start docker

# Logga ut och in igen för att gruppändringen ska ta effekt
exit
# Logga in igen via SSH
```

### 4.5 Verifiera installationen

```bash
docker --version
# Ska visa t.ex.: Docker version 27.x.x

docker compose version
# Ska visa t.ex.: Docker Compose version v2.x.x

docker run --rm hello-world
# Ska visa: Hello from Docker!
```

---

## 5. Förbered Traefik-kataloger och filer

### 5.1 Skapa katalogstruktur

```bash
sudo mkdir -p /etc/traefik/dynamic
sudo mkdir -p /var/log/traefik
```

### 5.2 Skapa certifikatfil för Let's Encrypt

```bash
sudo touch /etc/traefik/acme.json

# VIKTIGT: Filen MÅSTE ha 600-rättigheter, annars vägrar Traefik starta
sudo chmod 600 /etc/traefik/acme.json

# Verifiera
ls -la /etc/traefik/acme.json
# Ska visa: -rw------- 1 root root 0 ... acme.json
```

### 5.3 Kopiera konfigurationsfiler från repot

Från din lokala dator (där repot är utcheckat):

```bash
# Kopiera statisk Traefik-konfiguration
scp portal/infra/traefik/traefik.yml admin@<TRAEFIK-IP>:/tmp/traefik.yml
ssh admin@<TRAEFIK-IP> "sudo mv /tmp/traefik.yml /etc/traefik/traefik.yml"

# Kopiera Docker Compose-fil
scp portal/infra/traefik/docker-compose.yml admin@<TRAEFIK-IP>:/tmp/docker-compose.yml
ssh admin@<TRAEFIK-IP> "sudo mv /tmp/docker-compose.yml /etc/traefik/docker-compose.yml"

# Kopiera .env.example
scp portal/infra/traefik/.env.example admin@<TRAEFIK-IP>:/tmp/.env.example
ssh admin@<TRAEFIK-IP> "sudo mv /tmp/.env.example /etc/traefik/.env"
```

Alternativt kan du skapa filerna direkt på servern — se innehållet i:
- `portal/infra/traefik/traefik.yml`
- `portal/infra/traefik/docker-compose.yml`
- `portal/infra/traefik/.env.example`

### 5.4 Konfigurera miljövariabler

```bash
sudo nano /etc/traefik/.env
```

Fyll i värdena:

```env
# Huvuddomän för portalen
TRAEFIK_DEFAULT_DOMAIN=portal.example.com

# Dashboard-autentisering (generera med: htpasswd -nb admin dittlösenord)
TRAEFIK_DASHBOARD_AUTH=admin:$apr1$xyz$hash
```

> **Tips:** Installera `apache2-utils` för att generera htpasswd: `sudo apt install -y apache2-utils && htpasswd -nb admin dittlösenord`

### 5.5 Redigera Let's Encrypt e-post i traefik.yml

Traefik stödjer **inte** miljövariabel-expansion i sin YAML-config. E-postadressen måste hårdkodas:

```bash
sudo nano /etc/traefik/traefik.yml

# Ändra raden under certificatesResolvers → letsencrypt → acme:
# email: "ssl-admin@example.com"  →  email: "din-email@dittforetag.se"
```

---

## 6. Starta Traefik

### Alternativ A: Docker Compose (rekommenderat)

```bash
cd /etc/traefik
sudo docker compose up -d
```

### Alternativ B: Docker run

```bash
docker run -d \
  --name traefik \
  --restart=unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v /etc/traefik/traefik.yml:/etc/traefik/traefik.yml:ro \
  -v /etc/traefik/dynamic:/etc/traefik/dynamic:ro \
  -v /etc/traefik/acme.json:/etc/traefik/acme.json \
  -v /var/log/traefik:/var/log/traefik \
  traefik:v3.0
```

### Verifiera att containern körs

```bash
docker ps | grep traefik

# Kontrollera loggar
docker logs traefik --tail 50
```

---

## 7. Verifiera installation

### 7.1 Testa HTTP-redirect

```bash
curl -I http://<TRAEFIK-IP>
# Förväntat: HTTP/1.1 301 Moved Permanently
# Location: https://<TRAEFIK-IP>/
```

### 7.2 Kontrollera loggar

```bash
docker logs traefik 2>&1 | tail -20

# Sök efter fel
docker logs traefik 2>&1 | grep -i "error\|fatal\|panic"
```

### 7.3 Health check

```bash
# Om du startade med Docker Compose (healthcheck definierad)
docker inspect --format='{{.State.Health.Status}}' traefik
# Förväntat: healthy

# Manuell health check
docker exec traefik traefik healthcheck --ping
```

### 7.4 Kontrollera version

```bash
docker exec traefik traefik version
```

---

## 8. Skapa initial routing-konfiguration

När Traefik är installerat och körs behöver du skapa routing-filer så att trafik vidarebefordras till portal-applikationen.

Se dessa guider för routing-konfiguration:

- **Development och Production routing:** [`docs/CICD-SETUP.md` Del 6](CICD-SETUP.md#del-6-konfigurera-traefik) — Steg-för-steg för att skapa `cloudportal-dev.yml` och `cloudportal-prod.yml`
- **Custom domains:** [`portal/infra/traefik/README.md` Del 4](../portal/infra/traefik/README.md) — Initial `custom-domains.yml` och hur automatisk konfiguration fungerar

---

## 9. Konfigurera SFTP-sync-användare

Portalen laddar upp Traefik-konfiguration (custom domains) via SFTP. Följ guiden i [`portal/infra/traefik/README.md` Del 2](../portal/infra/traefik/README.md) för att:

1. Skapa SSH-nyckel på portal-servern
2. Skapa `traefik-sync`-användare på Traefik-servern
3. Ge skrivrättigheter till `/etc/traefik/dynamic/`
4. Testa SSH-anslutningen

---

## 10. Loggrotation

Traefik skriver loggar till `/var/log/traefik/`. Konfigurera logrotate så att loggarna inte fyller disken.

### 10.1 Skapa logrotate-konfiguration

```bash
sudo nano /etc/logrotate.d/traefik
```

Klistra in:

```
/var/log/traefik/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    postrotate
        docker kill --signal="USR1" traefik 2>/dev/null || true
    endscript
}
```

### 10.2 Testa konfigurationen

```bash
# Testa utan att faktiskt rotera (dry run)
sudo logrotate -d /etc/logrotate.d/traefik

# Tvinga rotation för att verifiera
sudo logrotate -f /etc/logrotate.d/traefik
```

---

## 11. Uppgradera Traefik

### 11.1 Kontrollera nuvarande version

```bash
docker exec traefik traefik version
```

### 11.2 Backup innan uppgradering

**Skapa alltid backup innan du uppgraderar:**

```bash
# Skapa backup-katalog
sudo mkdir -p /etc/traefik/backup/$(date +%Y%m%d)

# Backup certifikat (VIKTIGT — innehåller alla Let's Encrypt-certifikat)
sudo cp /etc/traefik/acme.json /etc/traefik/backup/$(date +%Y%m%d)/acme.json

# Backup konfiguration
sudo cp /etc/traefik/traefik.yml /etc/traefik/backup/$(date +%Y%m%d)/traefik.yml
sudo cp -r /etc/traefik/dynamic /etc/traefik/backup/$(date +%Y%m%d)/dynamic
sudo cp /etc/traefik/.env /etc/traefik/backup/$(date +%Y%m%d)/.env

# Om du använder Docker Compose
sudo cp /etc/traefik/docker-compose.yml /etc/traefik/backup/$(date +%Y%m%d)/docker-compose.yml

# Verifiera backup
ls -la /etc/traefik/backup/$(date +%Y%m%d)/
```

### 11.3 Uppgradera via Docker Compose (rekommenderat)

```bash
cd /etc/traefik

# Ändra image-tag i docker-compose.yml (t.ex. traefik:v3.0 → traefik:v3.1)
sudo nano docker-compose.yml
# Ändra raden: image: traefik:v3.0 → image: traefik:v3.1

# Dra ner ny image
sudo docker compose pull

# Starta om med ny version (zero-downtime)
sudo docker compose up -d --wait
```

### 11.4 Uppgradera via docker run

```bash
# Stoppa och ta bort nuvarande container
docker stop traefik
docker rm traefik

# Starta med ny image-tag (ändra v3.0 till önskad version)
docker run -d \
  --name traefik \
  --restart=unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v /etc/traefik/traefik.yml:/etc/traefik/traefik.yml:ro \
  -v /etc/traefik/dynamic:/etc/traefik/dynamic:ro \
  -v /etc/traefik/acme.json:/etc/traefik/acme.json \
  -v /var/log/traefik:/var/log/traefik \
  traefik:v3.1
```

> **Obs:** Med `docker run` finns ett kort avbrott medan containern startas om. Med Docker Compose och `--wait` minimeras avbrottet.

### 11.5 Verifiera efter uppgradering

```bash
# Kontrollera att ny version körs
docker exec traefik traefik version

# Kontrollera loggar för fel
docker logs traefik --tail 30

# Health check
docker exec traefik traefik healthcheck --ping

# Testa att routing fungerar
curl -I https://portal.example.com
# Förväntat: HTTP/2 200

# Kontrollera att certifikat fortfarande finns
sudo cat /etc/traefik/acme.json | jq '.letsencrypt.Certificates | length'
```

---

## 12. Nedgradera (rollback) Traefik-version

### När behöver man nedgradera?

- Breaking changes i ny version som påverkar routing
- Buggar i ny version
- Inkompatibiliteter med befintlig konfiguration

### 12.1 Stoppa nuvarande container

```bash
# Docker Compose
cd /etc/traefik
sudo docker compose down

# Eller docker run
docker stop traefik
docker rm traefik
```

### 12.2 Återställ konfiguration från backup

```bash
# Återställ acme.json (VIKTIGT: nyare acme.json kan vara inkompatibel med äldre version)
sudo cp /etc/traefik/backup/<DATUM>/acme.json /etc/traefik/acme.json
sudo chmod 600 /etc/traefik/acme.json

# Återställ traefik.yml (om config-format ändrats mellan versioner)
sudo cp /etc/traefik/backup/<DATUM>/traefik.yml /etc/traefik/traefik.yml

# Återställ dynamic-katalogen om nödvändigt
sudo cp -r /etc/traefik/backup/<DATUM>/dynamic/* /etc/traefik/dynamic/
```

> **Varning:** `acme.json` kan innehålla certifikatdata i ett format som ändrats mellan major-versioner. Återställ alltid `acme.json` från backup vid nedgradering.

### 12.3 Starta med äldre image-tag

```bash
# Docker Compose — ändra tillbaka image-tag
sudo nano /etc/traefik/docker-compose.yml
# Ändra image: traefik:v3.1 → image: traefik:v3.0

sudo docker compose up -d --wait

# Eller docker run
docker run -d \
  --name traefik \
  --restart=unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v /etc/traefik/traefik.yml:/etc/traefik/traefik.yml:ro \
  -v /etc/traefik/dynamic:/etc/traefik/dynamic:ro \
  -v /etc/traefik/acme.json:/etc/traefik/acme.json \
  -v /var/log/traefik:/var/log/traefik \
  traefik:v3.0
```

### 12.4 Verifiera rollback

```bash
# Bekräfta rätt version
docker exec traefik traefik version

# Kontrollera loggar
docker logs traefik --tail 30

# Testa routing
curl -I https://portal.example.com

# Kontrollera certifikat
sudo cat /etc/traefik/acme.json | jq '.letsencrypt.Certificates | length'
```

### Kompatibilitetsmatris

| Uppgradering | Kompatibilitet | Kommentar |
|---|---|---|
| v3.0 → v3.1 | Säker | Minor version, bakåtkompatibel |
| v3.x → v3.y (minor) | Säker | Minor versions inom v3 är bakåtkompatibla |
| v3.x → v2.x | Kräver config-omskrivning | Major version — `traefik.yml`-format skiljer sig väsentligt |
| v2.x → v3.x | Migrationsguide krävs | Se Traefiks officiella v2→v3 migreringsguide |

> **Rekommendation:** Håll dig inom samma major version (v3.x) för smidiga uppgraderingar och rollbacks.

---

## 13. Nästa steg

1. **Konfigurera routing** — Skapa dev- och prod-routingfiler: [`docs/CICD-SETUP.md` Del 6](CICD-SETUP.md#del-6-konfigurera-traefik)
2. **Konfigurera custom domains och SFTP** — Sätt upp SFTP-sync och custom domain-flöde: [`portal/infra/traefik/README.md`](../portal/infra/traefik/README.md)
3. **Första deployment** — Deploya portalen och verifiera end-to-end: [`docs/CICD-SETUP.md` Del 7](CICD-SETUP.md#del-7-första-deployment)
