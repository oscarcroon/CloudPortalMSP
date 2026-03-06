#!/usr/bin/env bash
# =============================================================================
# CloudPortal MSP - Traefik Edge Server Bootstrap & Härdning
# =============================================================================
# Automatiserat provisionerings-script för Traefik reverse proxy
# på en ren Ubuntu 24.04 LTS-server (t.ex. i DMZ).
#
# Gör det som docs/TRAEFIK-INSTALL.md beskriver manuellt, plus säkerhetshärdning.
#
# Användning:
#   1. Kopiera detta script till servern
#   2. Redigera konfigurationssektionen nedan
#   3. Kör: sudo bash bootstrap_traefik.sh
#   4. Kopiera traefik.yml, docker-compose.yml och .env från repot (se output)
#   5. Starta Traefik: cd /etc/traefik && docker compose up -d
#
# Krav: Ubuntu 24.04 LTS, root/sudo-åtkomst
# =============================================================================

set -euo pipefail

# =============================================================================
# KONFIGURATION - Anpassa dessa värden innan körning
# =============================================================================

# SSH-konfiguration
SSH_PORT=22
ALLOW_SSH_FROM="0.0.0.0/0"       # Byt till kontors-IP/nät, t.ex. "10.0.0.0/24"

# Traefik-kataloger
TRAEFIK_DIR="/etc/traefik"
TRAEFIK_LOG_DIR="/var/log/traefik"

# SFTP-sync-användare (portalen laddar upp dynamic config via SFTP)
SYNC_USER="traefik-sync"

# Journald
JOURNAL_MAX_SIZE="500M"

# Docker-image version
TRAEFIK_VERSION="v3.0"

# =============================================================================
# HJÄLPFUNKTIONER
# =============================================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[FEL]${NC}   $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Detta script måste köras som root (sudo bash $0)"
        exit 1
    fi
}

check_ubuntu() {
    if ! grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
        log_error "Detta script kräver Ubuntu (24.04 LTS rekommenderas)"
        exit 1
    fi
    log_info "OS: $(lsb_release -ds)"
}

# =============================================================================
# STEG 1: Systemuppdatering & baspaket
# =============================================================================
step_system_update() {
    log_info "=== Steg 1: Systemuppdatering & baspaket ==="

    export DEBIAN_FRONTEND=noninteractive

    apt-get update -qq
    apt-get upgrade -y -qq

    apt-get install -y -qq \
        curl \
        wget \
        jq \
        htop \
        ncdu \
        tree \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg

    log_info "Baspaket installerade"
}

# =============================================================================
# STEG 2: Installera Docker CE (officiell repo)
# =============================================================================
step_install_docker() {
    log_info "=== Steg 2: Installerar Docker CE ==="

    if command -v docker &>/dev/null; then
        log_info "Docker redan installerad: $(docker --version)"
        return
    fi

    # Lägg till Dockers officiella GPG-nyckel
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Lägg till Docker-repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Aktivera Docker vid uppstart
    systemctl enable docker
    systemctl start docker

    log_info "Docker installerad: $(docker --version)"
    log_info "Docker Compose: $(docker compose version)"
}

# =============================================================================
# STEG 3: Traefik-katalogstruktur och acme.json
# =============================================================================
step_create_traefik_dirs() {
    log_info "=== Steg 3: Skapar Traefik-katalogstruktur ==="

    mkdir -p "${TRAEFIK_DIR}/dynamic"
    mkdir -p "${TRAEFIK_LOG_DIR}"

    # acme.json — Let's Encrypt certifikatlagring
    if [[ ! -f "${TRAEFIK_DIR}/acme.json" ]]; then
        touch "${TRAEFIK_DIR}/acme.json"
        chmod 600 "${TRAEFIK_DIR}/acme.json"
        log_info "Skapade acme.json med 600-rättigheter"
    else
        log_info "acme.json finns redan"
        # Säkerställ rätt rättigheter
        chmod 600 "${TRAEFIK_DIR}/acme.json"
    fi

    # logs-katalog för Docker Compose (relativ till TRAEFIK_DIR)
    mkdir -p "${TRAEFIK_DIR}/logs"

    log_info "Katalogstruktur:"
    log_info "  ${TRAEFIK_DIR}/"
    log_info "  ├── traefik.yml         (statisk config — kopiera från repo)"
    log_info "  ├── docker-compose.yml  (Docker Compose — kopiera från repo)"
    log_info "  ├── .env                (miljövariabler — kopiera från repo)"
    log_info "  ├── acme.json           (Let's Encrypt certifikat, 600)"
    log_info "  ├── logs/               (Traefik-loggar via Compose)"
    log_info "  └── dynamic/            (dynamisk config, SFTP-uppdaterad)"
    log_info "  ${TRAEFIK_LOG_DIR}/     (Traefik-loggar via docker run)"
}

# =============================================================================
# STEG 4: SFTP-sync-användare
# =============================================================================
step_create_sync_user() {
    log_info "=== Steg 4: Skapar SFTP-sync-användare '${SYNC_USER}' ==="

    if id "$SYNC_USER" &>/dev/null; then
        log_info "Användare '${SYNC_USER}' finns redan"
    else
        useradd \
            --system \
            --shell /bin/bash \
            --home-dir "/home/${SYNC_USER}" \
            --create-home \
            "$SYNC_USER"
        log_info "Systemanvändare '${SYNC_USER}' skapad"
    fi

    # SSH-katalog för sync-användaren
    mkdir -p "/home/${SYNC_USER}/.ssh"
    chmod 700 "/home/${SYNC_USER}/.ssh"
    touch "/home/${SYNC_USER}/.ssh/authorized_keys"
    chmod 600 "/home/${SYNC_USER}/.ssh/authorized_keys"
    chown -R "${SYNC_USER}:${SYNC_USER}" "/home/${SYNC_USER}/.ssh"

    # Ge skrivrättigheter till dynamic-katalogen
    groupadd -f traefik
    usermod -aG traefik "$SYNC_USER"
    chown root:traefik "${TRAEFIK_DIR}/dynamic"
    chmod 775 "${TRAEFIK_DIR}/dynamic"

    log_info "SFTP-sync konfigurerad:"
    log_info "  Användare: ${SYNC_USER}"
    log_info "  SSH-nycklar: /home/${SYNC_USER}/.ssh/authorized_keys"
    log_info "  Skrivbar katalog: ${TRAEFIK_DIR}/dynamic/ (grupp: traefik)"
    log_warn "VIKTIGT: Lägg till portalserverns publika SSH-nyckel i authorized_keys!"
}

# =============================================================================
# STEG 5: UFW-brandvägg
# =============================================================================
step_configure_ufw() {
    log_info "=== Steg 5: Konfigurerar UFW-brandvägg ==="

    apt-get install -y -qq ufw

    # Standardregler
    ufw default deny incoming
    ufw default allow outgoing

    # SSH
    if [[ "$ALLOW_SSH_FROM" == "0.0.0.0/0" ]]; then
        ufw allow "${SSH_PORT}/tcp" comment 'SSH'
        log_warn "SSH öppet från alla IP-adresser. Överväg att begränsa med ALLOW_SSH_FROM."
    else
        ufw allow from "$ALLOW_SSH_FROM" to any port "$SSH_PORT" proto tcp comment 'SSH (begränsat)'
        log_info "SSH begränsat till: ${ALLOW_SSH_FROM}"
    fi

    # HTTP och HTTPS (krävs för Traefik + Let's Encrypt HTTP-01 challenge)
    ufw allow 80/tcp comment 'HTTP (Traefik + ACME)'
    ufw allow 443/tcp comment 'HTTPS (Traefik)'

    # Aktivera (--force för icke-interaktiv körning)
    ufw --force enable

    log_info "UFW aktiverad. Tillåtna anslutningar:"
    ufw status numbered
}

# =============================================================================
# STEG 6: SSH-härdning
# =============================================================================
step_harden_ssh() {
    log_info "=== Steg 6: SSH-härdning ==="

    local sshd_config="/etc/ssh/sshd_config"

    # Backup
    cp "$sshd_config" "${sshd_config}.bak.$(date +%Y%m%d_%H%M%S)"

    # Skapa drop-in-konfiguration istället för att redigera huvudfilen
    mkdir -p /etc/ssh/sshd_config.d

    cat > /etc/ssh/sshd_config.d/99-traefik-hardening.conf << EOF
# CloudPortal MSP Traefik Edge - SSH-härdning
# Genererad av bootstrap_traefik.sh

Port ${SSH_PORT}
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
X11Forwarding no
MaxAuthTries 5
ClientAliveInterval 300
ClientAliveCountMax 2
AllowAgentForwarding no
AllowTcpForwarding no
EOF

    # Verifiera konfigurationen innan omstart
    if sshd -t 2>/dev/null; then
        systemctl reload sshd || systemctl reload ssh
        log_info "SSH härdad och laddad om"
    else
        log_error "SSH-konfigurationsfel! Återställer..."
        rm -f /etc/ssh/sshd_config.d/99-traefik-hardening.conf
        log_error "Kontrollera SSH-konfigurationen manuellt"
    fi

    log_warn "VIKTIGT: Se till att du har SSH-nyckel konfigurerad innan du loggar ut!"
}

# =============================================================================
# STEG 7: fail2ban (SSH brute-force-skydd)
# =============================================================================
step_install_fail2ban() {
    log_info "=== Steg 7: Installerar fail2ban ==="

    apt-get install -y -qq fail2ban

    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ${SSH_PORT}
filter  = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime  = 7200
EOF

    systemctl enable fail2ban
    systemctl restart fail2ban
    log_info "fail2ban installerad (SSH: max 3 försök, 2h ban)"
}

# =============================================================================
# STEG 8: Kernel/sysctl-härdning
# =============================================================================
step_harden_kernel() {
    log_info "=== Steg 8: Kernel/sysctl-härdning ==="

    cat > /etc/sysctl.d/99-traefik-hardening.conf << 'EOF'
# CloudPortal MSP Traefik Edge - Kernel-härdning

# Förhindra IP-spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignorera ICMP-broadcasts (smurf-attacker)
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Logga misstänkta paket (martians)
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Blockera source routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# Ignorera ICMP-redirects (MITM-skydd)
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# SYN flood-skydd
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_synack_retries = 2

# Förhindra IP-forwarding (detta är inte en router)
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# Randomisera minnesadresser (ASLR)
kernel.randomize_va_space = 2

# Öka anslutningsgränser (edge proxy hanterar många anslutningar)
net.core.somaxconn = 65535
net.ipv4.tcp_max_tw_buckets = 1440000
net.core.netdev_max_backlog = 5000
EOF

    sysctl --system > /dev/null 2>&1
    log_info "Kernel-härdning applicerad (med edge proxy-optimeringar)"
}

# =============================================================================
# STEG 9: unattended-upgrades (automatiska säkerhetspatchar)
# =============================================================================
step_configure_unattended_upgrades() {
    log_info "=== Steg 9: Konfigurerar unattended-upgrades ==="

    apt-get install -y -qq unattended-upgrades apt-listchanges

    cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

    cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

    systemctl enable unattended-upgrades
    log_info "Automatiska säkerhetspatchar aktiverade"
}

# =============================================================================
# STEG 10: Persistent journald
# =============================================================================
step_configure_journald() {
    log_info "=== Steg 10: Konfigurerar persistent journald ==="

    mkdir -p /var/log/journal

    mkdir -p /etc/systemd/journald.conf.d
    cat > /etc/systemd/journald.conf.d/traefik.conf << EOF
[Journal]
Storage=persistent
SystemMaxUse=${JOURNAL_MAX_SIZE}
SystemMaxFileSize=50M
MaxRetentionSec=90day
Compress=yes
EOF

    systemctl restart systemd-journald
    log_info "Journald: persistent lagring, max ${JOURNAL_MAX_SIZE}, 90 dagars retention"
}

# =============================================================================
# STEG 11: Loggrotation för Traefik
# =============================================================================
step_configure_logrotate() {
    log_info "=== Steg 11: Konfigurerar loggrotation ==="

    cat > /etc/logrotate.d/traefik << 'EOF'
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
EOF

    log_info "Loggrotation konfigurerad (daglig, behåll 14 dagar, komprimerad)"
}

# =============================================================================
# STEG 12: Dra ner Traefik Docker-image
# =============================================================================
step_pull_traefik_image() {
    log_info "=== Steg 12: Drar ner Traefik Docker-image ==="

    docker pull "traefik:${TRAEFIK_VERSION}"
    log_info "Image hämtad: traefik:${TRAEFIK_VERSION}"
}

# =============================================================================
# SAMMANFATTNING
# =============================================================================
print_summary() {
    echo ""
    echo "============================================================================="
    echo -e "${GREEN} CloudPortal MSP - Traefik Edge Bootstrap KLAR${NC}"
    echo "============================================================================="
    echo ""
    echo "Installerat:"
    echo "  - Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
    echo "  - Docker Compose $(docker compose version --short)"
    echo "  - Traefik image: traefik:${TRAEFIK_VERSION} (nedladdad)"
    echo "  - fail2ban, UFW, unattended-upgrades"
    echo ""
    echo "Konfigurerat:"
    echo "  - Kataloger:    ${TRAEFIK_DIR}/, ${TRAEFIK_LOG_DIR}/"
    echo "  - acme.json:    ${TRAEFIK_DIR}/acme.json (chmod 600)"
    echo "  - SFTP-sync:    ${SYNC_USER} (skrivbehörighet till ${TRAEFIK_DIR}/dynamic/)"
    echo "  - Brandvägg:    SSH (port ${SSH_PORT}), HTTP (80), HTTPS (443)"
    echo "  - SSH:          Härdad (root-login av, lösenord av)"
    echo "  - Loggrotation: /var/log/traefik/*.log (14 dagar)"
    echo "  - Journald:     Persistent, max ${JOURNAL_MAX_SIZE}"
    echo ""
    echo "============================================================================="
    echo " Nästa steg"
    echo "============================================================================="
    echo ""
    echo "  1. Kopiera konfigurationsfiler från repot till denna server:"
    echo ""
    echo "     scp portal/infra/traefik/traefik.yml      admin@<IP>:${TRAEFIK_DIR}/traefik.yml"
    echo "     scp portal/infra/traefik/docker-compose.yml admin@<IP>:${TRAEFIK_DIR}/docker-compose.yml"
    echo "     scp portal/infra/traefik/.env.example      admin@<IP>:${TRAEFIK_DIR}/.env"
    echo ""
    echo "  2. Redigera .env med dina värden:"
    echo "     nano ${TRAEFIK_DIR}/.env"
    echo ""
    echo "  3. Starta Traefik:"
    echo "     cd ${TRAEFIK_DIR} && docker compose up -d"
    echo ""
    echo "  4. Verifiera:"
    echo "     docker ps | grep traefik"
    echo "     curl -I http://localhost    # Förvänta 301 -> HTTPS"
    echo ""
    echo "  5. Lägg till portalserverns SSH-nyckel för SFTP-sync:"
    echo "     nano /home/${SYNC_USER}/.ssh/authorized_keys"
    echo "     Se: portal/infra/traefik/README.md, Del 2"
    echo ""
    echo "  6. Skapa routing-konfiguration:"
    echo "     Se: docs/CICD-SETUP.md, Del 6"
    echo ""
    echo -e "${YELLOW}VIKTIGT: Verifiera att du har SSH-nyckel konfigurerad"
    echo -e "innan du stänger denna session!${NC}"
    echo "============================================================================="
}

# =============================================================================
# HUVUDPROGRAM
# =============================================================================
main() {
    echo "============================================================================="
    echo " CloudPortal MSP - Traefik Edge Server Bootstrap & Härdning"
    echo " Mål: Ubuntu 24.04 LTS"
    echo "============================================================================="
    echo ""

    check_root
    check_ubuntu

    step_system_update
    step_install_docker
    step_create_traefik_dirs
    step_create_sync_user
    step_configure_ufw
    step_harden_ssh
    step_install_fail2ban
    step_harden_kernel
    step_configure_unattended_upgrades
    step_configure_journald
    step_configure_logrotate
    step_pull_traefik_image

    print_summary
}

main "$@"
