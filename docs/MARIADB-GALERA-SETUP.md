# MariaDB Galera Cluster - Installationsguide

Steg-för-steg-guide för att sätta upp ett 3-nods MariaDB Galera Cluster på Ubuntu 24.04 LTS med MariaDB 11.8. Konfigurationen är optimerad för servrar med 8 GB RAM.

> **Obs:** Denna guide täcker installation och konfiguration av själva klustret. För att skapa databaser och användare för CloudPortal, se [`docs/CICD-SETUP.md` Del 5](CICD-SETUP.md#del-5-konfigurera-databas).

## Innehållsförteckning

1. [Förutsättningar](#1-förutsättningar)
2. [Serverförberedelse](#2-serverförberedelse)
3. [Installera MariaDB 11.8](#3-installera-mariadb-118)
4. [Konfigurera Galera Cluster](#4-konfigurera-galera-cluster)
5. [Brandvägg (UFW)](#5-brandvägg-ufw)
6. [Bootstrap klustret](#6-bootstrap-klustret)
7. [Verifiera klustret](#7-verifiera-klustret)
8. [Skapa databaser för CloudPortal](#8-skapa-databaser-för-cloudportal)
9. [Konfigurera Virtual IP (Keepalived)](#9-konfigurera-virtual-ip-keepalived)
10. [Backup-strategi (Mariabackup)](#10-backup-strategi-mariabackup)
11. [Övervakning](#11-övervakning)
12. [Nodåterställning](#12-nodåterställning)
13. [Fullständig klusteråterställning](#13-fullständig-klusteråterställning)
14. [Uppgradera MariaDB](#14-uppgradera-mariadb)
15. [Felsökning](#15-felsökning)

---

## 1. Förutsättningar

### Servrar

| Nod | Hostname | IP-adress | Roll |
|-----|----------|-----------|------|
| Node 1 | `galera01` | `10.0.2.1` | Bootstrap-nod (första gången) |
| Node 2 | `galera02` | `10.0.2.2` | |
| Node 3 | `galera03` | `10.0.2.3` | |
| VIP | `galera-vip` | `10.0.2.100` | Virtual IP (Keepalived) |

> **Anpassa** alla IP-adresser och hostnames till din miljö.

### Krav per nod

- **OS:** Ubuntu 24.04 LTS
- **RAM:** 8 GB
- **Disk:** SSD rekommenderas (minst 50 GB)
- **Nätverk:** Alla noder kan nå varandra på port 3306, 4444, 4567, 4568
- **SSH:** Root eller sudo-åtkomst

### Nätverksportar

| Port | Protokoll | Beskrivning |
|------|-----------|-------------|
| 3306 | TCP | MariaDB klient-anslutningar |
| 4444 | TCP | SST (State Snapshot Transfer) |
| 4567 | TCP/UDP | Galera cluster-kommunikation |
| 4568 | TCP | IST (Incremental State Transfer) |

---

## 2. Serverförberedelse

Utför på **alla tre noder**.

### 2.1 Uppdatera systemet

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Sätt hostname och tidszon

```bash
# Node 1:
sudo hostnamectl set-hostname galera01

# Node 2:
sudo hostnamectl set-hostname galera02

# Node 3:
sudo hostnamectl set-hostname galera03

# Alla noder:
sudo timedatectl set-timezone Europe/Stockholm
```

### 2.3 Konfigurera /etc/hosts

Lägg till alla noder i `/etc/hosts` på **varje nod** (så att hostname-resolution fungerar utan DNS):

```bash
sudo nano /etc/hosts
```

Lägg till:

```
10.0.2.1    galera01
10.0.2.2    galera02
10.0.2.3    galera03
```

### 2.4 Synkronisera tid (chrony)

Galera kräver synkroniserade klockor mellan noderna.

```bash
sudo apt install -y chrony
sudo systemctl enable chrony
sudo systemctl start chrony

# Verifiera
chronyc tracking
```

---

## 3. Installera MariaDB 11.8

Utför på **alla tre noder**.

### 3.1 Lägg till MariaDB:s officiella repository

```bash
# Installera beroenden
sudo apt install -y curl software-properties-common gnupg

# Lägg till MariaDB signing key
curl -fsSL https://mariadb.org/mariadb_release_signing_key.pgp | sudo gpg --dearmor -o /usr/share/keyrings/mariadb-keyring.gpg

# Lägg till MariaDB 11.8 repository för Ubuntu 24.04 (Noble)
echo "deb [signed-by=/usr/share/keyrings/mariadb-keyring.gpg] https://mirror.mariadb.org/repo/11.8/ubuntu noble main" | sudo tee /etc/apt/sources.list.d/mariadb.list
```

### 3.2 Installera MariaDB och Galera

```bash
sudo apt update
sudo apt install -y mariadb-server mariadb-client mariadb-backup galera-4
```

### 3.3 Verifiera installationen

```bash
mariadbd --version
# Förväntat: mariadbd  Ver 11.8.x-MariaDB ...

# Stoppa MariaDB (vi konfigurerar först, startar sedan via Galera bootstrap)
sudo systemctl stop mariadb
```

### 3.4 Säkerhetshärdning (valfritt nu, kan göras efter bootstrap)

```bash
sudo mariadb-secure-installation
```

Rekommenderade svar:
- Switch to unix_socket authentication: **n** (behåll lösenord)
- Set root password: **Y** (sätt ett starkt root-lösenord)
- Remove anonymous users: **Y**
- Disallow root login remotely: **Y**
- Remove test database: **Y**
- Reload privilege tables: **Y**

> **Obs:** Om du kör detta nu måste du stoppa MariaDB igen innan du går vidare till steg 4: `sudo systemctl stop mariadb`

---

## 4. Konfigurera Galera Cluster

### 4.1 Galera-konfiguration

Skapa konfigurationsfilen på **alla tre noder**:

```bash
sudo nano /etc/mysql/mariadb.conf.d/60-galera.cnf
```

Klistra in följande konfiguration. **Anpassa `wsrep_node_address` och `wsrep_node_name` per nod** (markerat nedan):

```ini
# =============================================================================
# MariaDB Galera Cluster Configuration
# Optimerad för: 3 noder, 8 GB RAM per nod, SSD-disk
# MariaDB 11.8 / Galera 4 / Ubuntu 24.04 LTS
# =============================================================================

[mysqld]

# ---------------------------------------------------------------------------
# Galera Cluster Settings
# ---------------------------------------------------------------------------
wsrep_on                        = ON
wsrep_provider                  = /usr/lib/galera/libgalera_smm.so
wsrep_cluster_name              = cloudportal-galera
wsrep_cluster_address           = gcomm://10.0.2.1,10.0.2.2,10.0.2.3

# >>> ANPASSA PER NOD <<<
# Node 1: wsrep_node_address = 10.0.2.1 / wsrep_node_name = galera01
# Node 2: wsrep_node_address = 10.0.2.2 / wsrep_node_name = galera02
# Node 3: wsrep_node_address = 10.0.2.3 / wsrep_node_name = galera03
wsrep_node_address              = 10.0.2.1
wsrep_node_name                 = galera01

# SST (State Snapshot Transfer) — mariabackup är säkrast (non-blocking)
wsrep_sst_method                = mariabackup
wsrep_sst_auth                  = mariabackup:ÄNDRA_TILL_SÄKERT_LÖSENORD

# Replikering
wsrep_slave_threads             = 4
wsrep_log_conflicts             = ON
wsrep_certify_nonPK             = ON

# Galera cache — IST (Incremental State Transfer) vid korta avbrott
# 512 MB räcker för ~timme vid normal skrivlast
wsrep_provider_options          = "gcache.size=512M; gcache.recover=yes"

# ---------------------------------------------------------------------------
# InnoDB — optimerad för 8 GB RAM
# ---------------------------------------------------------------------------
# Buffer pool: ~50% av RAM (lämnar utrymme för OS, Galera, anslutningar)
innodb_buffer_pool_size         = 4G
innodb_buffer_pool_instances    = 4

# Redo-loggar
innodb_log_file_size            = 512M
innodb_log_buffer_size          = 64M

# I/O
innodb_flush_log_at_trx_commit  = 2
innodb_flush_method             = O_DIRECT
innodb_io_capacity              = 1000
innodb_io_capacity_max          = 2000

# Filformat
innodb_file_per_table           = ON
innodb_default_row_format       = dynamic

# Autoinkrementering — Galera kräver interleaved locking
innodb_autoinc_lock_mode        = 2

# Dubbelskrivbuffert (kan stängas av med Galera om disk har atomic writes)
innodb_doublewrite              = ON

# ---------------------------------------------------------------------------
# Allmänna inställningar
# ---------------------------------------------------------------------------
bind-address                    = 0.0.0.0
default_storage_engine          = InnoDB

# Anslutningar
max_connections                 = 200
max_connect_errors              = 100000
wait_timeout                    = 600
interactive_timeout             = 600

# Tempminne per anslutning
tmp_table_size                  = 64M
max_heap_table_size             = 64M
join_buffer_size                = 2M
sort_buffer_size                = 2M
read_buffer_size                = 1M
read_rnd_buffer_size            = 1M

# Teckenkodning
character-set-server            = utf8mb4
collation-server                = utf8mb4_unicode_ci

# Binärlogg (Galera kräver ROW-format)
binlog_format                   = ROW
log_bin                         = /var/log/mysql/mariadb-bin
log_bin_index                   = /var/log/mysql/mariadb-bin.index
expire_logs_days                = 7
max_binlog_size                 = 256M

# Slow query log
slow_query_log                  = ON
slow_query_log_file             = /var/log/mysql/slow-query.log
long_query_time                 = 2

# Error log
log_error                       = /var/log/mysql/error.log
log_warnings                    = 2
```

### 4.2 Anpassa per nod

**Node 1** (`galera01`) — redan korrekt i exemplet ovan.

**Node 2** (`galera02`) — ändra dessa två rader:

```ini
wsrep_node_address              = 10.0.2.2
wsrep_node_name                 = galera02
```

**Node 3** (`galera03`) — ändra dessa två rader:

```ini
wsrep_node_address              = 10.0.2.3
wsrep_node_name                 = galera03
```

### 4.3 Skapa SST-användare

SST-användaren behövs för `mariabackup` vid State Snapshot Transfer. Vi skapar den efter bootstrap (steg 6).

### 4.4 Skapa loggkatalog

```bash
# Alla noder
sudo mkdir -p /var/log/mysql
sudo chown mysql:mysql /var/log/mysql
```

---

## 5. Brandvägg (UFW)

Utför på **alla tre noder**.

```bash
# Tillåt MariaDB-klient
sudo ufw allow from 10.0.2.0/24 to any port 3306 proto tcp comment 'MariaDB client'

# Tillåt Galera-kommunikation mellan noder
sudo ufw allow from 10.0.2.0/24 to any port 4444 proto tcp comment 'Galera SST'
sudo ufw allow from 10.0.2.0/24 to any port 4567 proto tcp comment 'Galera cluster'
sudo ufw allow from 10.0.2.0/24 to any port 4567 proto udp comment 'Galera cluster (UDP)'
sudo ufw allow from 10.0.2.0/24 to any port 4568 proto tcp comment 'Galera IST'

# Tillåt MariaDB från applikationsservrar (anpassa IP/nät)
sudo ufw allow from 10.0.1.0/24 to any port 3306 proto tcp comment 'App servers -> MariaDB'

# Om du använder Keepalived (VIP)
sudo ufw allow from 10.0.2.0/24 to any proto vrrp comment 'Keepalived VRRP'

# Verifiera
sudo ufw status numbered
```

---

## 6. Bootstrap klustret

### 6.1 Starta första noden (bootstrap)

> **VIKTIGT:** Bootstrap ska **bara** köras på **en** nod, **en** gång — vid första uppstart av klustret. Kör aldrig bootstrap på en nod som redan är del av ett körande kluster.

**[Node 1]** (`galera01`):

```bash
# Säkerställ att MariaDB är stoppad
sudo systemctl stop mariadb

# Bootstrap klustret (startar en ny Galera-instans)
sudo galera_new_cluster

# Verifiera att det startade
sudo systemctl status mariadb

# Kontrollera klusterstorlek (ska vara 1)
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_cluster_size';"
# +--------------------+-------+
# | Variable_name      | Value |
# +--------------------+-------+
# | wsrep_cluster_size | 1     |
# +--------------------+-------+
```

### 6.2 Skapa SST-användare

**[Node 1]** — medan bara node 1 körs:

```bash
sudo mariadb
```

```sql
-- Skapa användare för State Snapshot Transfer (mariabackup)
CREATE USER IF NOT EXISTS 'mariabackup'@'localhost'
  IDENTIFIED BY 'ÄNDRA_TILL_SÄKERT_LÖSENORD';

GRANT RELOAD, PROCESS, LOCK TABLES, BINLOG MONITOR ON *.* TO 'mariabackup'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

> **Viktigt:** Lösenordet måste matcha `wsrep_sst_auth` i `60-galera.cnf`.

### 6.3 Starta övriga noder

**[Node 2]** (`galera02`):

```bash
sudo systemctl start mariadb

# Verifiera — ska visa klusterstorlek 2
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_cluster_size';"
```

**[Node 3]** (`galera03`):

```bash
sudo systemctl start mariadb

# Verifiera — ska visa klusterstorlek 3
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_cluster_size';"
```

### 6.4 Verifiera att alla noder är synkade

Kör på **valfri nod**:

```bash
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_%';" | grep -E 'cluster_size|cluster_status|connected|ready|local_state_comment'
```

Förväntat resultat:

```
wsrep_cluster_size          3
wsrep_cluster_status        Primary
wsrep_connected             ON
wsrep_ready                 ON
wsrep_local_state_comment   Synced
```

---

## 7. Verifiera klustret

### 7.1 Testa replikering

**[Node 1]:**

```bash
sudo mariadb -e "CREATE DATABASE galera_test; USE galera_test; CREATE TABLE t1 (id INT PRIMARY KEY, val VARCHAR(50)); INSERT INTO t1 VALUES (1, 'från node 1');"
```

**[Node 2]:**

```bash
sudo mariadb -e "SELECT * FROM galera_test.t1;"
# Förväntat: id=1, val='från node 1'

# Skriv från node 2
sudo mariadb -e "INSERT INTO galera_test.t1 VALUES (2, 'från node 2');"
```

**[Node 3]:**

```bash
sudo mariadb -e "SELECT * FROM galera_test.t1;"
# Förväntat: 2 rader — data från alla noder

# Städa upp
sudo mariadb -e "DROP DATABASE galera_test;"
```

### 7.2 Kontrollera klusterstatus (detaljerad)

```bash
sudo mariadb -e "
SELECT
  VARIABLE_NAME,
  VARIABLE_VALUE
FROM information_schema.GLOBAL_STATUS
WHERE VARIABLE_NAME IN (
  'wsrep_cluster_size',
  'wsrep_cluster_status',
  'wsrep_connected',
  'wsrep_ready',
  'wsrep_local_state_comment',
  'wsrep_incoming_addresses',
  'wsrep_evs_state',
  'wsrep_flow_control_paused',
  'wsrep_cert_deps_distance',
  'wsrep_local_send_queue_avg',
  'wsrep_local_recv_queue_avg'
)
ORDER BY VARIABLE_NAME;
"
```

Viktiga värden:
- `wsrep_cluster_status` = **Primary** (klustret har quorum)
- `wsrep_flow_control_paused` = **0.000000** (ingen backpressure)
- `wsrep_local_send_queue_avg` = nära **0** (inget kö-problem)

---

## 8. Skapa databaser för CloudPortal

Se [`docs/CICD-SETUP.md` Del 5](CICD-SETUP.md#del-5-konfigurera-databas) för fullständiga instruktioner. Kortversion:

```bash
sudo mariadb
```

```sql
-- Development
CREATE DATABASE IF NOT EXISTS cloudportal_dev
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cloudportal_dev'@'%'
  IDENTIFIED BY 'ÄNDRA_DEV_LÖSENORD';
GRANT ALL PRIVILEGES ON cloudportal_dev.* TO 'cloudportal_dev'@'%';

-- Production
CREATE DATABASE IF NOT EXISTS cloudportal_prod
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cloudportal_prod'@'%'
  IDENTIFIED BY 'ÄNDRA_PROD_LÖSENORD';
GRANT ALL PRIVILEGES ON cloudportal_prod.* TO 'cloudportal_prod'@'%';

FLUSH PRIVILEGES;
```

> **VIKTIGT:** Generera unika lösenord med `openssl rand -base64 24`. Använd aldrig samma lösenord för dev och prod.

---

## 9. Konfigurera Virtual IP (Keepalived)

En Virtual IP (VIP) ger applikationen en stabil adress (`galera-vip.internal` / `10.0.2.100`) som alltid pekar mot en aktiv nod.

### 9.1 Installera Keepalived

Utför på **alla tre noder**:

```bash
sudo apt install -y keepalived
```

### 9.2 Skapa hälsokontroll-script

```bash
sudo nano /usr/local/bin/check_galera.sh
```

```bash
#!/bin/bash
# Kontrollera att MariaDB körs och Galera är redo
STATUS=$(mariadb -u root -e "SHOW STATUS LIKE 'wsrep_ready';" --batch --skip-column-names 2>/dev/null | awk '{print $2}')
if [ "$STATUS" = "ON" ]; then
    exit 0
else
    exit 1
fi
```

```bash
sudo chmod +x /usr/local/bin/check_galera.sh
```

### 9.3 Konfigurera Keepalived

**[Node 1]** (`galera01`) — MASTER:

```bash
sudo nano /etc/keepalived/keepalived.conf
```

```
vrrp_script check_galera {
    script "/usr/local/bin/check_galera.sh"
    interval 5
    weight -20
    fall 3
    rise 2
}

vrrp_instance GALERA_VIP {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 100
    advert_int 1

    authentication {
        auth_type PASS
        auth_pass ÄNDRA_TILL_HEMLIGT_LÖSENORD
    }

    virtual_ipaddress {
        10.0.2.100/24
    }

    track_script {
        check_galera
    }
}
```

> **Anpassa:** `interface eth0` till ditt nätverksgränssnitt (kolla med `ip a`).

**[Node 2]** (`galera02`) — BACKUP:

Samma config som ovan men ändra:

```
    state BACKUP
    priority 90
```

**[Node 3]** (`galera03`) — BACKUP:

Samma config som ovan men ändra:

```
    state BACKUP
    priority 80
```

### 9.4 Starta Keepalived

Utför på **alla tre noder**:

```bash
sudo systemctl enable keepalived
sudo systemctl start keepalived
```

### 9.5 Verifiera VIP

```bash
# Kolla vilken nod som har VIP:en
ip a | grep 10.0.2.100

# Testa anslutning via VIP
mysql -h 10.0.2.100 -u root -p -e "SHOW STATUS LIKE 'wsrep_node_name';"
```

---

## 10. Backup-strategi (Mariabackup)

### 10.1 Skapa backup-script

```bash
sudo nano /usr/local/bin/galera-backup.sh
```

```bash
#!/bin/bash
# =============================================================================
# MariaDB Galera Cluster - Backup med Mariabackup
# =============================================================================
# Kör som cronjob: 0 2 * * * /usr/local/bin/galera-backup.sh
# =============================================================================

set -euo pipefail

BACKUP_DIR="/var/backups/mariadb"
RETENTION_DAYS=14
DATE=$(date +%Y%m%d_%H%M%S)
TARGET="${BACKUP_DIR}/${DATE}"
LOG="${BACKUP_DIR}/backup.log"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Startar backup..." >> "$LOG"

# Kör full backup
mariabackup --backup \
    --target-dir="$TARGET" \
    --user=mariabackup \
    --password='ÄNDRA_TILL_SÄKERT_LÖSENORD' \
    2>> "$LOG"

# Förbered backup (gör den konsistent)
mariabackup --prepare --target-dir="$TARGET" 2>> "$LOG"

echo "[$(date)] Backup klar: $TARGET" >> "$LOG"

# Rensa gamla backups
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -not -name "$(basename $BACKUP_DIR)" -exec rm -rf {} + 2>> "$LOG"

echo "[$(date)] Gamla backups rensade (behåller ${RETENTION_DAYS} dagar)" >> "$LOG"
```

```bash
sudo chmod +x /usr/local/bin/galera-backup.sh
```

### 10.2 Schemalägg backup med cron

```bash
# Kör backup kl 02:00 varje natt — kör bara på EN nod (t.ex. node 3)
sudo crontab -e
```

Lägg till:

```
0 2 * * * /usr/local/bin/galera-backup.sh
```

### 10.3 Testa backup manuellt

```bash
sudo /usr/local/bin/galera-backup.sh
ls -la /var/backups/mariadb/
```

### 10.4 Återställa från backup

```bash
# 1. Stoppa MariaDB
sudo systemctl stop mariadb

# 2. Flytta bort befintlig data
sudo mv /var/lib/mysql /var/lib/mysql.old

# 3. Återställ från backup
sudo mariabackup --copy-back --target-dir=/var/backups/mariadb/<DATUM>

# 4. Rätt rättigheter
sudo chown -R mysql:mysql /var/lib/mysql

# 5. Starta MariaDB
sudo systemctl start mariadb
```

---

## 11. Övervakning

### 11.1 Snabbkontroll-script

Skapa ett script som ger överblick:

```bash
sudo nano /usr/local/bin/galera-status.sh
```

```bash
#!/bin/bash
# Galera Cluster snabbstatus
echo "=== Galera Cluster Status ==="
echo ""

mariadb -e "
SELECT
  @@hostname AS node_name,
  (SELECT VARIABLE_VALUE FROM information_schema.GLOBAL_STATUS WHERE VARIABLE_NAME='wsrep_cluster_size') AS cluster_size,
  (SELECT VARIABLE_VALUE FROM information_schema.GLOBAL_STATUS WHERE VARIABLE_NAME='wsrep_cluster_status') AS cluster_status,
  (SELECT VARIABLE_VALUE FROM information_schema.GLOBAL_STATUS WHERE VARIABLE_NAME='wsrep_local_state_comment') AS node_state,
  (SELECT VARIABLE_VALUE FROM information_schema.GLOBAL_STATUS WHERE VARIABLE_NAME='wsrep_connected') AS connected,
  (SELECT VARIABLE_VALUE FROM information_schema.GLOBAL_STATUS WHERE VARIABLE_NAME='wsrep_ready') AS ready
\G"

echo "=== Flow Control ==="
mariadb -e "
SELECT
  (SELECT VARIABLE_VALUE FROM information_schema.GLOBAL_STATUS WHERE VARIABLE_NAME='wsrep_flow_control_paused') AS fc_paused,
  (SELECT VARIABLE_VALUE FROM information_schema.GLOBAL_STATUS WHERE VARIABLE_NAME='wsrep_local_send_queue_avg') AS send_queue_avg,
  (SELECT VARIABLE_VALUE FROM information_schema.GLOBAL_STATUS WHERE VARIABLE_NAME='wsrep_local_recv_queue_avg') AS recv_queue_avg
\G"

echo "=== Incoming Addresses ==="
mariadb -e "SHOW STATUS LIKE 'wsrep_incoming_addresses';" --batch --skip-column-names
```

```bash
sudo chmod +x /usr/local/bin/galera-status.sh
```

Kör med: `sudo galera-status.sh`

### 11.2 Viktiga mätvärden att övervaka

| Variabel | Bra värde | Varning |
|----------|-----------|---------|
| `wsrep_cluster_size` | 3 | < 3 = nod nere |
| `wsrep_cluster_status` | Primary | Non-Primary = quorum förlorat |
| `wsrep_ready` | ON | OFF = noden accepterar ej frågor |
| `wsrep_local_state_comment` | Synced | Joining/Donor = SST pågår |
| `wsrep_flow_control_paused` | < 0.01 | > 0.1 = en nod hänger inte med |
| `wsrep_local_recv_queue_avg` | < 0.5 | > 1.0 = noden sackar efter |

---

## 12. Nodåterställning

### Scenario A: En nod har startat om (kort avbrott)

Galera försöker automatiskt IST (Incremental State Transfer) om gapet ryms i `gcache` (512 MB).

```bash
# Starta noden — den joinar automatiskt
sudo systemctl start mariadb

# Verifiera
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_local_state_comment';"
# Förväntat: Synced (efter kort stund)
```

### Scenario B: En nod har varit nere länge (SST krävs)

Om gapet är för stort för IST görs automatiskt SST (full kopia via mariabackup). Detta tar längre tid men sker automatiskt.

```bash
sudo systemctl start mariadb
# Vänta — SST kan ta minuter beroende på datastorlek

# Övervaka progress
sudo tail -f /var/log/mysql/error.log
```

### Scenario C: En nod vägrar starta (`safe_to_bootstrap: 0`)

Om alla tre noder stängdes ned (t.ex. vid strömavbrott) behöver du identifiera vilken nod som har senaste data.

```bash
# Kontrollera på ALLA noder:
sudo cat /var/lib/mysql/grastate.dat
```

Den nod som har `safe_to_bootstrap: 1` eller högst `seqno` ska bootas först:

```bash
# Om ingen nod har safe_to_bootstrap: 1, sätt det manuellt
# på noden med högst seqno:
sudo sed -i 's/safe_to_bootstrap: 0/safe_to_bootstrap: 1/' /var/lib/mysql/grastate.dat

# Bootstrap den noden
sudo galera_new_cluster

# Starta de övriga
# [Node 2]: sudo systemctl start mariadb
# [Node 3]: sudo systemctl start mariadb
```

### Scenario D: Nod med korrupt data

```bash
# 1. Stoppa den trasiga noden
sudo systemctl stop mariadb

# 2. Flytta bort korrupt data
sudo mv /var/lib/mysql /var/lib/mysql.corrupt

# 3. Skapa ny tom datakatalog
sudo mkdir /var/lib/mysql
sudo chown mysql:mysql /var/lib/mysql

# 4. Starta — Galera gör automatiskt full SST från en frisk nod
sudo systemctl start mariadb

# 5. Övervaka
sudo tail -f /var/log/mysql/error.log
```

---

## 13. Fullständig klusteråterställning

Om **alla noder** har gått ner och klustret inte kan bootas:

### 13.1 Hitta noden med senaste data

Kör på **alla tre noder**:

```bash
sudo mariabackup --print-wsrep-position 2>/dev/null || \
sudo cat /var/lib/mysql/grastate.dat
```

Noden med högst `seqno` (sequence number) har senaste data.

### 13.2 Bootstrap från bästa nod

```bash
# På noden med högst seqno:
sudo sed -i 's/safe_to_bootstrap: 0/safe_to_bootstrap: 1/' /var/lib/mysql/grastate.dat
sudo galera_new_cluster

# Verifiera
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_cluster_size';"
# Förväntat: 1
```

### 13.3 Joina övriga noder

```bash
# Node 2:
sudo systemctl start mariadb

# Node 3:
sudo systemctl start mariadb

# Verifiera (alla noder):
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_cluster_size';"
# Förväntat: 3
```

---

## 14. Uppgradera MariaDB

### 14.1 Rullande uppgradering (minor version, t.ex. 11.8.1 → 11.8.2)

Uppgradera **en nod i taget** för zero downtime:

```bash
# === Nod 3 (börja med lägst prioritet) ===

# 1. Sätt noden i maintenance-läge (Galera desync)
sudo mariadb -e "SET GLOBAL wsrep_desync=ON;"

# 2. Stoppa MariaDB
sudo systemctl stop mariadb

# 3. Uppgradera
sudo apt update
sudo apt install -y mariadb-server mariadb-client mariadb-backup

# 4. Starta
sudo systemctl start mariadb

# 5. Kör upgrade-script
sudo mariadb-upgrade

# 6. Verifiera
sudo mariadb -e "SELECT VERSION(); SHOW STATUS LIKE 'wsrep_cluster_size';"

# 7. Avaktivera desync
sudo mariadb -e "SET GLOBAL wsrep_desync=OFF;"

# Upprepa för Node 2, sedan Node 1
```

### 14.2 Major version-uppgradering (t.ex. 11.4 → 11.8)

Major-uppgraderingar kräver mer försiktighet:

1. **Ta full backup** av alla databaser
2. Uppgradera en nod i taget (samma steg som ovan)
3. Kör `mariadb-upgrade` efter varje nod
4. Övervaka loggar för deprecation warnings

---

## 15. Felsökning

### Klustret tappar quorum (Non-Primary)

Om 2 av 3 noder går ner tappar den kvarvarande noden quorum och vägrar skriva.

```bash
# Kontrollera status
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_cluster_status';"
# Visar: Non-Primary

# Om du är SÄKER på att den kvarvarande noden har senaste data:
sudo mariadb -e "SET GLOBAL wsrep_provider_options='pc.bootstrap=YES';"

# Starta sedan de andra noderna
```

> **VARNING:** Kör bara `pc.bootstrap=YES` om du är helt säker. Felaktig användning kan orsaka dataförlust.

### SST tar lång tid

Vid stor datamängd kan SST (full kopia) ta lång tid. Övervaka:

```bash
# På noden som gör SST (donor):
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_local_state_comment';"
# Visar: Donor/Desynced

# På noden som tar emot SST (joiner):
sudo tail -f /var/log/mysql/error.log
```

### "Duplicate entry" eller deadlocks

Galera kan ge deadlock-liknande fel vid hög skriv-last från flera noder. Applikationen ska hantera:

```
Error 1213 (40001): Deadlock found
Error 1047 (08S01): WSREP has not yet prepared node for application use
```

**Lösning:** Applikationen ska ha retry-logik för dessa fel. CloudPortal hanterar detta via Drizzle ORM:s transaktioner.

### Kontrollera att alla noder har samma data

```bash
# Kör på alla noder — wsrep_last_committed ska vara nära identiskt
sudo mariadb -e "SHOW STATUS LIKE 'wsrep_last_committed';"
```

### Inga loggar / tom error.log

```bash
# Kontrollera att loggkatalogen finns och har rätt rättigheter
ls -la /var/log/mysql/
sudo chown mysql:mysql /var/log/mysql
sudo systemctl restart mariadb
```

---

## Minnesbudget (8 GB RAM)

| Komponent | Tilldelning | Beskrivning |
|-----------|------------|-------------|
| InnoDB Buffer Pool | 4 096 MB | Databasinnehåll i minne |
| InnoDB Log Buffer | 64 MB | Redo-logg-buffert |
| Galera gcache | 512 MB | IST-cache |
| Galera cert index | ~100 MB | Certifieringsindex |
| Per-anslutning buffertar | ~10 MB × 200 | sort, join, tmp (max ~400 MB vid full last) |
| OS + övriga | ~1 500 MB | Kernel, filsystem-cache, processer |
| **Totalt** | **~6 700 MB** | Lämnar marginal under 8 GB |

> **Tips:** Övervaka med `free -h` och `htop`. Om servern swappar, minska `innodb_buffer_pool_size` till 3G.

---

## Filreferens

| Fil | Plats | Beskrivning |
|-----|-------|-------------|
| `60-galera.cnf` | `/etc/mysql/mariadb.conf.d/` | Galera + InnoDB-konfiguration |
| `keepalived.conf` | `/etc/keepalived/` | VIP-konfiguration |
| `galera-backup.sh` | `/usr/local/bin/` | Backup-script (cron) |
| `galera-status.sh` | `/usr/local/bin/` | Statusöverblick |
| `check_galera.sh` | `/usr/local/bin/` | Hälsokontroll för Keepalived |
| `grastate.dat` | `/var/lib/mysql/` | Galera state (bootstrap-info) |
| `error.log` | `/var/log/mysql/` | MariaDB error log |
| `slow-query.log` | `/var/log/mysql/` | Långsamma frågor |
