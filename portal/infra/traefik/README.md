# Traefik Edge Server - Installationsguide

Den här guiden beskriver hur du konfigurerar Traefik som edge proxy för CloudPortal MSP med stöd för custom domains och automatiska SSL-certifikat via Let's Encrypt.

## Arkitektur

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                    │
│                                                                          │
│    Kund besöker:  https://portal.kundforetag.se                         │
│                              │                                           │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRAEFIK EDGE SERVER (192.168.2.130)                  │
│                                                                          │
│   ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────┐   │
│   │   Port 80   │───▶│ Redirect     │    │ /etc/traefik/dynamic/   │   │
│   │   (HTTP)    │    │ to HTTPS     │    │                         │   │
│   └─────────────┘    └──────────────┘    │ - custom-domains.yml    │   │
│                                          │ - redirects-*.yml       │   │
│   ┌─────────────┐    ┌──────────────┐    └────────────▲────────────┘   │
│   │   Port 443  │───▶│ Traefik      │                 │                │
│   │   (HTTPS)   │    │ Router       │     SFTP Upload │                │
│   └─────────────┘    └──────┬───────┘                 │                │
│                             │                         │                │
│   ┌─────────────────────────┼─────────────────────────┼────────────┐   │
│   │  Let's Encrypt          │                         │            │   │
│   │  /etc/traefik/acme.json │                         │            │   │
│   │  (SSL-certifikat)       │                         │            │   │
│   └─────────────────────────┼─────────────────────────┼────────────┘   │
└─────────────────────────────┼─────────────────────────┼────────────────┘
                              │                         │
                              ▼                         │
┌─────────────────────────────────────────────────────────────────────────┐
│                    PORTAL SERVER (t.ex. 10.0.0.5:3000)                  │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Nuxt Portal Application                       │   │
│   │                                                                  │   │
│   │  - Hanterar custom domain verifiering                           │   │
│   │  - Genererar Traefik-konfiguration                              │   │
│   │  - Laddar upp config via SFTP                                   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Förutsättningar

- **Traefik-server**: Linux-server med Docker eller systemd (192.168.2.130)
- **Portal-server**: Nuxt-applikationen körande (t.ex. 10.0.0.5:3000)
- **DNS**: Huvuddomän (t.ex. portal.example.com) pekar mot Traefik-servern
- **Brandvägg**: Port 80 och 443 öppna mot internet på Traefik-servern
- **Nätverksåtkomst**: Portal-servern kan nå Traefik-servern via SSH (port 22)

---

## DEL 1: Konfigurera Traefik-servern

> **📍 Alla kommandon i denna del körs på Traefik-servern (192.168.2.130)**

### Steg 1.1: Skapa katalogstruktur

```bash
# Anslut till Traefik-servern
ssh root@192.168.2.130

# Skapa nödvändiga kataloger
sudo mkdir -p /etc/traefik/dynamic
sudo mkdir -p /var/log/traefik

# Verifiera
ls -la /etc/traefik/
```

### Steg 1.2: Skapa certifikatfil för Let's Encrypt

```bash
# Skapa tom acme.json (här sparas alla SSL-certifikat)
sudo touch /etc/traefik/acme.json

# VIKTIGT: Filen MÅSTE ha 600-rättigheter, annars vägrar Traefik starta
sudo chmod 600 /etc/traefik/acme.json

# Verifiera rättigheter
ls -la /etc/traefik/acme.json
# Ska visa: -rw------- 1 root root 0 ... acme.json
```

### Steg 1.3: Kopiera Traefik-konfigurationen

Kopiera `traefik.yml` från detta repository till servern:

```bash
# Alternativ 1: Från din lokala dator
scp portal/infra/traefik/traefik.yml root@192.168.2.130:/etc/traefik/traefik.yml

# Alternativ 2: Skapa filen direkt på servern
sudo nano /etc/traefik/traefik.yml
# Klistra in innehållet från traefik.yml
```

### Steg 1.4: Redigera e-postadress för Let's Encrypt

```bash
# Redigera traefik.yml
sudo nano /etc/traefik/traefik.yml

# Ändra denna rad till din e-postadress:
# email: "ssl-admin@example.com"  →  email: "din-email@dittforetag.se"
```

**⚠️ Viktigt**: Let's Encrypt skickar varningar till denna e-post när certifikat snart går ut.

### Steg 1.5: Starta Traefik med Docker

```bash
# Starta Traefik-containern
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

# Verifiera att containern körs
docker ps | grep traefik

# Kontrollera loggarna
docker logs traefik
```

### Steg 1.6: Verifiera att Traefik fungerar

```bash
# Testa HTTP (ska ge redirect till HTTPS)
curl -I http://192.168.2.130

# Ska visa: HTTP/1.1 301 Moved Permanently
# Location: https://192.168.2.130/
```

---

## DEL 2: Konfigurera SSH-nyckel för SFTP-sync

Portalen behöver kunna ladda upp konfigurationsfiler till Traefik via SFTP.

### Steg 2.1: Skapa SSH-nyckel på Portal-servern

> **📍 Dessa kommandon körs på Portal-servern (där Nuxt-appen körs)**

```bash
# Anslut till portal-servern (exempel)
ssh admin@10.0.0.5

# Skapa en dedikerad SSH-nyckel för Traefik-sync
ssh-keygen -t ed25519 -C "traefik-sync" -f ~/.ssh/traefik_sync_key -N ""

# Visa publika nyckeln (kopiera denna)
cat ~/.ssh/traefik_sync_key.pub
```

Kopiera hela raden som börjar med `ssh-ed25519 ...`

### Steg 2.2: Skapa sync-användare på Traefik-servern

> **📍 Dessa kommandon körs på Traefik-servern (192.168.2.130)**

```bash
# Anslut till Traefik-servern
ssh root@192.168.2.130

# Skapa användare för config-uploads
sudo useradd -m -s /bin/bash traefik-sync

# Skapa .ssh-katalog
sudo mkdir -p /home/traefik-sync/.ssh
sudo chmod 700 /home/traefik-sync/.ssh

# Lägg till den publika nyckeln från portal-servern
sudo nano /home/traefik-sync/.ssh/authorized_keys
# Klistra in nyckeln från steg 2.1 och spara

# Sätt rätt rättigheter
sudo chmod 600 /home/traefik-sync/.ssh/authorized_keys
sudo chown -R traefik-sync:traefik-sync /home/traefik-sync/.ssh
```

### Steg 2.3: Ge sync-användaren skrivrättigheter

```bash
# På Traefik-servern (192.168.2.130)

# Lägg till traefik-grupp
sudo groupadd -f traefik
sudo usermod -aG traefik traefik-sync

# Ge skrivrättigheter till dynamic-katalogen
sudo chown root:traefik /etc/traefik/dynamic
sudo chmod 775 /etc/traefik/dynamic

# Verifiera
ls -la /etc/traefik/ | grep dynamic
# Ska visa: drwxrwxr-x ... traefik dynamic
```

### Steg 2.4: Testa SSH-anslutningen

> **📍 Körs på Portal-servern**

```bash
# Testa anslutningen från portal-servern
ssh -i ~/.ssh/traefik_sync_key traefik-sync@192.168.2.130 "echo 'SSH fungerar!'"

# Testa att skriva en testfil
ssh -i ~/.ssh/traefik_sync_key traefik-sync@192.168.2.130 "touch /etc/traefik/dynamic/test.txt && rm /etc/traefik/dynamic/test.txt && echo 'Skrivrättigheter OK!'"
```

Om båda testerna lyckas är SSH-konfigurationen klar!

---

## DEL 3: Konfigurera Portal-applikationen

> **📍 Dessa ändringar görs i Portalen (på portal-servern eller i din `.env`-fil)**

### Steg 3.1: Sätt miljövariabler

Lägg till följande i din `.env`-fil eller systemets miljövariabler:

```env
# =============================================================================
# Traefik Custom Domains Configuration
# =============================================================================

# Aktivera custom domain-funktionen
TRAEFIK_DOMAINS_ENABLED=true

# URL till portal-applikationen (som Traefik ser den internt)
TRAEFIK_PORTAL_BACKEND_URL=http://10.0.0.5:3000

# Huvuddomän för portalen (standard-domänen)
TRAEFIK_DEFAULT_DOMAIN=portal.example.com

# E-post för Let's Encrypt certifikat-notifieringar
TRAEFIK_ACME_EMAIL=ssl-admin@example.com

# =============================================================================
# SFTP Configuration for Traefik Config Sync
# =============================================================================

# Traefik-serverns IP eller hostname
TRAEFIK_SFTP_HOST=192.168.2.130

# SSH-port (standard: 22)
TRAEFIK_SFTP_PORT=22

# Användarnamn för SFTP
TRAEFIK_SFTP_USERNAME=traefik-sync

# Sökväg till den privata SSH-nyckeln (på portal-servern)
TRAEFIK_SFTP_KEY_PATH=/home/portal/.ssh/traefik_sync_key

# Katalog på Traefik-servern där config ska laddas upp
TRAEFIK_SFTP_REMOTE_DIR=/etc/traefik/dynamic
```

### Steg 3.2: Starta om portalen

```bash
# Om du kör med PM2
pm2 restart portal

# Om du kör med systemd
sudo systemctl restart portal

# Om du kör i utvecklingsläge
npm run dev
```

### Steg 3.3: Verifiera SFTP-anslutningen via portalen

1. Logga in som superadmin i portalen
2. Gå till Admin → Traefik Status (eller anropa API:et direkt):

```bash
# Testa SFTP-anslutningen via API
curl -X POST https://portal.example.com/api/admin/traefik/test-connection \
  -H "Cookie: auth-token=<din-token>"
```

---

## DEL 4: Skapa första custom domain

### Steg 4.1: Konfigurera DNS för huvuddomänen

Skapa dessa DNS-poster hos din DNS-leverantör:

| Typ | Namn | Värde |
|-----|------|-------|
| A | portal.example.com | 192.168.2.130 |
| A | *.portal.example.com | 192.168.2.130 |

### Steg 4.2: Skapa initial Traefik-konfiguration

> **📍 Körs på Traefik-servern (192.168.2.130)**

Skapa en initial konfigurationsfil för huvuddomänen:

```bash
# Skapa custom-domains.yml manuellt första gången
sudo nano /etc/traefik/dynamic/custom-domains.yml
```

Klistra in:

```yaml
# Initial Traefik Custom Domains Configuration
# Auto-generated configurations will replace this file

http:
  routers:
    portal-default:
      rule: "Host(`portal.example.com`)"
      service: portal-service
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  services:
    portal-service:
      loadBalancer:
        servers:
          - url: "http://10.0.0.5:3000"
        passHostHeader: true
```

**Byt ut**:
- `portal.example.com` → din huvuddomän
- `10.0.0.5:3000` → din portal-servers interna IP och port

### Steg 4.3: Verifiera certifikat

```bash
# Vänta 30-60 sekunder, kontrollera sedan loggarna
docker logs traefik 2>&1 | grep -i "certificate"

# Kontrollera att certifikat skapats
sudo cat /etc/traefik/acme.json | jq '.letsencrypt.Certificates | length'
# Ska visa: 1 (eller fler)

# Visa vilka domäner som har certifikat
sudo cat /etc/traefik/acme.json | jq '.letsencrypt.Certificates[].domain.main'
```

### Steg 4.4: Testa i webbläsaren

Öppna https://portal.example.com i din webbläsare:
- ✅ Sidan ska laddas
- ✅ Hänglåset ska visa giltigt certifikat från Let's Encrypt

---

## Flöde för Custom Domains

När allt är konfigurerat fungerar flödet så här:

```
1. Organisation sätter custom domain i portalen
   └─▶ portal.kundforetag.se

2. Portalen genererar verifieringstoken
   └─▶ "Lägg till TXT-post: _cloudportal-verify.portal.kundforetag.se"

3. Kunden lägger till DNS TXT-post hos sin DNS-leverantör

4. Portalen verifierar DNS (automatiskt var 5:e minut eller manuellt)
   └─▶ Status ändras till "Verified"

5. Portalen genererar ny Traefik-config och laddar upp via SFTP
   └─▶ /etc/traefik/dynamic/custom-domains.yml uppdateras

6. Traefik upptäcker ändringen (file watcher) och laddar om config
   └─▶ Ny router skapas för portal.kundforetag.se

7. Traefik begär SSL-certifikat från Let's Encrypt (HTTP-01 challenge)
   └─▶ Certifikat sparas i /etc/traefik/acme.json

8. Kunden kan nu besöka https://portal.kundforetag.se
```

---

## Felsökning

### Traefik startar inte

```bash
# Kontrollera loggar
docker logs traefik

# Vanliga fel:
# - "permission denied" på acme.json → Kör: sudo chmod 600 /etc/traefik/acme.json
# - "file not found" → Kontrollera att alla volymer finns
```

### Certifikat skapas inte

```bash
# Kontrollera att port 80 är öppen (Let's Encrypt HTTP-01 challenge)
curl -I http://din-doman.se/.well-known/acme-challenge/test

# Kontrollera DNS
dig +short din-doman.se
# Ska visa Traefik-serverns IP

# Kontrollera Traefik-loggar
docker logs traefik 2>&1 | grep -i "acme\|certificate\|challenge"
```

### SFTP-upload misslyckas

```bash
# Testa anslutningen manuellt från portal-servern
sftp -i /path/to/key traefik-sync@192.168.2.130

# Kontrollera rättigheter på Traefik-servern
ls -la /etc/traefik/dynamic/

# Kontrollera att nyckeln är korrekt
ssh -i /path/to/key -v traefik-sync@192.168.2.130
```

### Konfigurationen laddas inte om

```bash
# Traefik ska auto-reload, men du kan tvinga omstart
docker restart traefik

# Verifiera att filen finns och är giltig YAML
cat /etc/traefik/dynamic/custom-domains.yml
yamllint /etc/traefik/dynamic/custom-domains.yml
```

---

## Säkerhet

### Let's Encrypt Rate Limits

- **50 certifikat** per registrerad domän per vecka
- **5 duplicerade certifikat** per vecka
- Portalen verifierar domänägandeskap innan Traefik-config skapas för att undvika onödiga certifikat-förfrågningar

### SFTP-säkerhet

- Använd **endast SSH-nyckel** (ingen lösenordsautentisering)
- sync-användaren har **begränsade rättigheter** (endast /etc/traefik/dynamic)
- Överväg att begränsa användaren ytterligare med `chroot` eller `ForceCommand`

### DNS-verifiering

- Alla custom domains **måste verifieras** via DNS TXT-post innan de läggs till i Traefik
- Detta förhindrar att någon kapar en domän de inte äger

---

## Filreferens

| Fil | Plats | Beskrivning |
|-----|-------|-------------|
| `traefik.yml` | `/etc/traefik/traefik.yml` | Statisk huvudkonfiguration |
| `acme.json` | `/etc/traefik/acme.json` | SSL-certifikat (auto-genereras) |
| `custom-domains.yml` | `/etc/traefik/dynamic/` | Custom domain routers (auto-sync) |
| `redirects-*.yml` | `/etc/traefik/dynamic/` | Redirect-config per organisation |
