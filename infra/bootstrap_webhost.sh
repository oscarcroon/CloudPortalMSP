#!/usr/bin/env bash
# =============================================================================
# CloudPortal MSP - Server Bootstrap & Härdning
# =============================================================================
# Automatiserat provisionerings-script för Ubuntu 24.04 LTS-servrar.
# Gör det som docs/CICD-SETUP.md beskriver manuellt, plus säkerhetshärdning.
#
# Användning:
#   1. Kopiera detta script till servern
#   2. Redigera konfigurationssektionen nedan
#   3. Kör: sudo bash bootstrap_webhost.sh
#
# Krav: Ubuntu 24.04 LTS, root/sudo-åtkomst
# =============================================================================

set -euo pipefail

# =============================================================================
# KONFIGURATION - Anpassa dessa värden innan körning
# =============================================================================
APP_USER="cloudportal"
APP_DIR="/opt/cloudportal"
APP_PORT=3000
NODE_VERSION="22"

# Traefik reverse proxy IP (vem får ansluta till APP_PORT)
TRAEFIK_IP="192.168.2.130"

# SSH-konfiguration
SSH_PORT=22
ALLOW_SSH_FROM="0.0.0.0/0"       # Byt till kontors-IP/nät, t.ex. "10.0.0.0/24"

# Systemd-resursgränser
MEMORY_MAX="2G"                   # Max minne för applikationen
CPU_QUOTA="200%"                  # Max CPU (200% = 2 kärnor)

# Journald
JOURNAL_MAX_SIZE="1G"

# Miljöbeskrivning (visas i systemd service)
ENV_LABEL="Production"            # Eller "Development"

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
        git \
        build-essential \
        jq \
        unzip \
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
# STEG 2: Node.js 22 LTS via NodeSource
# =============================================================================
step_install_node() {
    log_info "=== Steg 2: Installerar Node.js ${NODE_VERSION} LTS ==="

    if command -v node &>/dev/null; then
        local current_version
        current_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$current_version" == "$NODE_VERSION" ]]; then
            log_info "Node.js ${NODE_VERSION} redan installerad: $(node --version)"
            return
        fi
        log_warn "Node.js $(node --version) hittades, uppgraderar till v${NODE_VERSION}"
    fi

    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    apt-get install -y -qq nodejs

    log_info "Node.js installerad: $(node --version)"
    log_info "npm installerad: $(npm --version)"
}

# =============================================================================
# STEG 3: Skapa applikationsanvändare (bash-shell)
# =============================================================================
step_create_user() {
    log_info "=== Steg 3: Skapar applikationsanvändare '${APP_USER}' ==="

    if id "$APP_USER" &>/dev/null; then
        log_info "Användare '${APP_USER}' finns redan"
    else
        useradd \
            --system \
            --shell /bin/bash \
            --home-dir "/home/${APP_USER}" \
            --create-home \
            "$APP_USER"
        log_info "Systemanvändare '${APP_USER}' skapad (bash-shell)"
    fi
}

# =============================================================================
# STEG 4: Katalogstruktur
# =============================================================================
step_create_directories() {
    log_info "=== Steg 4: Skapar katalogstruktur ==="

    mkdir -p "${APP_DIR}/releases"
    mkdir -p "${APP_DIR}/shared/uploads"
    mkdir -p "${APP_DIR}/shared/logs"

    chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
    chmod 750 "$APP_DIR"

    log_info "Katalogstruktur:"
    log_info "  ${APP_DIR}/"
    log_info "  ├── releases/          (deploy-versioner)"
    log_info "  ├── current -> releases/xxx  (symlink till aktiv release)"
    log_info "  └── shared/"
    log_info "      ├── .env           (miljövariabler)"
    log_info "      ├── uploads/       (persistent filuppladdning)"
    log_info "      └── logs/          (applikationsloggar)"
}

# =============================================================================
# STEG 5: Sudoers (begränsad systemctl-åtkomst)
# =============================================================================
step_configure_sudoers() {
    log_info "=== Steg 5: Konfigurerar sudoers ==="

    cat > /etc/sudoers.d/cloudportal << 'SUDOERS'
# CloudPortal MSP - Tillåt applikationsanvändaren att hantera tjänsten
cloudportal ALL=(root) NOPASSWD: /bin/systemctl restart cloudportal
cloudportal ALL=(root) NOPASSWD: /bin/systemctl start cloudportal
cloudportal ALL=(root) NOPASSWD: /bin/systemctl stop cloudportal
cloudportal ALL=(root) NOPASSWD: /bin/systemctl status cloudportal
cloudportal ALL=(root) NOPASSWD: /bin/systemctl is-active cloudportal
SUDOERS

    chmod 440 /etc/sudoers.d/cloudportal
    visudo -c -f /etc/sudoers.d/cloudportal
    log_info "Sudoers konfigurerad (begränsad systemctl-åtkomst)"
}

# =============================================================================
# STEG 6: Systemd service unit
# =============================================================================
step_create_systemd_service() {
    log_info "=== Steg 6: Skapar systemd service ==="

    cat > /etc/systemd/system/cloudportal.service << EOF
[Unit]
Description=CloudPortal MSP - ${ENV_LABEL}
Documentation=https://github.com/your-org/cloudportal-msp
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/current/portal
EnvironmentFile=${APP_DIR}/shared/.env
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
ReadWritePaths=${APP_DIR}
PrivateTmp=true
# OBS: MemoryDenyWriteExecute är MEDVETET UTELÄMNAD
# V8:s JIT-kompilator kräver W+X-minne, annars segfault

# Resurshantering
MemoryMax=${MEMORY_MAX}
CPUQuota=${CPU_QUOTA}

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable cloudportal

    log_info "Systemd service skapad och aktiverad"
    log_info "  Entry point: node .output/server/index.mjs"
    log_info "  MemoryMax: ${MEMORY_MAX}, CPUQuota: ${CPU_QUOTA}"
    log_info "  OBS: MemoryDenyWriteExecute=true är INTE satt (V8 JIT-krav)"
}

# =============================================================================
# STEG 7: UFW-brandvägg
# =============================================================================
step_configure_ufw() {
    log_info "=== Steg 7: Konfigurerar UFW-brandvägg ==="

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

    # Traefik -> applikationsport
    ufw allow from "$TRAEFIK_IP" to any port "$APP_PORT" proto tcp comment 'Traefik -> CloudPortal'

    # Aktivera (--force för icke-interaktiv körning)
    ufw --force enable

    log_info "UFW aktiverad. Tillåtna anslutningar:"
    ufw status numbered
}

# =============================================================================
# STEG 8: SSH-härdning
# =============================================================================
step_harden_ssh() {
    log_info "=== Steg 8: SSH-härdning ==="

    local sshd_config="/etc/ssh/sshd_config"

    # Backup
    cp "$sshd_config" "${sshd_config}.bak.$(date +%Y%m%d_%H%M%S)"

    # Skapa drop-in-konfiguration istället för att redigera huvudfilen
    mkdir -p /etc/ssh/sshd_config.d

    cat > /etc/ssh/sshd_config.d/99-cloudportal-hardening.conf << EOF
# CloudPortal MSP - SSH-härdning
# Genererad av bootstrap_webhost.sh

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
        rm -f /etc/ssh/sshd_config.d/99-cloudportal-hardening.conf
        log_error "Kontrollera SSH-konfigurationen manuellt"
    fi

    log_warn "VIKTIGT: Se till att du har SSH-nyckel konfigurerad innan du loggar ut!"
}

# =============================================================================
# STEG 9: fail2ban (SSH brute-force-skydd)
# =============================================================================
step_install_fail2ban() {
    log_info "=== Steg 9: Installerar fail2ban ==="

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
# STEG 10: Kernel/sysctl-härdning
# =============================================================================
step_harden_kernel() {
    log_info "=== Steg 10: Kernel/sysctl-härdning ==="

    cat > /etc/sysctl.d/99-cloudportal-hardening.conf << 'EOF'
# CloudPortal MSP - Kernel-härdning

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
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2

# Förhindra IP-forwarding (detta är inte en router)
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# Randomisera minnesadresser (ASLR)
kernel.randomize_va_space = 2
EOF

    sysctl --system > /dev/null 2>&1
    log_info "Kernel-härdning applicerad"
}

# =============================================================================
# STEG 11: unattended-upgrades (automatiska säkerhetspatchar)
# =============================================================================
step_configure_unattended_upgrades() {
    log_info "=== Steg 11: Konfigurerar unattended-upgrades ==="

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
# STEG 12: Persistent journald
# =============================================================================
step_configure_journald() {
    log_info "=== Steg 12: Konfigurerar persistent journald ==="

    mkdir -p /var/log/journal

    mkdir -p /etc/systemd/journald.conf.d
    cat > /etc/systemd/journald.conf.d/cloudportal.conf << EOF
[Journal]
Storage=persistent
SystemMaxUse=${JOURNAL_MAX_SIZE}
SystemMaxFileSize=100M
MaxRetentionSec=90day
Compress=yes
EOF

    systemctl restart systemd-journald
    log_info "Journald: persistent lagring, max ${JOURNAL_MAX_SIZE}, 90 dagars retention"
}

# =============================================================================
# STEG 13: MariaDB-klient (felsökning)
# =============================================================================
step_install_mariadb_client() {
    log_info "=== Steg 13: Installerar MariaDB-klient ==="

    apt-get install -y -qq mariadb-client
    log_info "MariaDB-klient installerad: $(mysql --version)"
}

# =============================================================================
# STEG 14: Kopiera env-mall
# =============================================================================
step_copy_env_template() {
    log_info "=== Steg 14: Miljövariabler (.env) ==="

    local env_file="${APP_DIR}/shared/.env"

    if [[ -f "$env_file" ]]; then
        log_warn ".env-filen finns redan: ${env_file}"
        log_warn "Hoppar över kopiering. Kontrollera manuellt mot infra/env.prod.example."
    else
        # Skapa minimal .env som påminnelse
        cat > "$env_file" << 'ENVTEMPLATE'
# CloudPortal MSP - Miljövariabler
# Kopiera innehållet från infra/env.prod.example och fyll i dina värden.
# Se: docs/CICD-SETUP.md för detaljer.
NODE_ENV=production
ENVTEMPLATE

        chown "${APP_USER}:${APP_USER}" "$env_file"
        chmod 600 "$env_file"
        log_info "Skapade minimal .env i ${env_file}"
        log_warn "VIKTIGT: Kopiera infra/env.prod.example till servern och fyll i alla värden!"
    fi
}

# =============================================================================
# SAMMANFATTNING
# =============================================================================
print_summary() {
    echo ""
    echo "============================================================================="
    echo -e "${GREEN} CloudPortal MSP - Bootstrap KLAR${NC}"
    echo "============================================================================="
    echo ""
    echo "Installerat:"
    echo "  - Node.js $(node --version)"
    echo "  - npm $(npm --version)"
    echo "  - MariaDB-klient"
    echo "  - fail2ban, UFW, unattended-upgrades"
    echo ""
    echo "Konfigurerat:"
    echo "  - Användare:    ${APP_USER} (systemkonto, bash-shell)"
    echo "  - App-katalog:  ${APP_DIR}/"
    echo "  - Systemd:      cloudportal.service"
    echo "  - Brandvägg:    SSH (port ${SSH_PORT}), Traefik ${TRAEFIK_IP} -> port ${APP_PORT}"
    echo "  - SSH:          Härdad (root-login av, lösenord av)"
    echo "  - Journald:     Persistent, max ${JOURNAL_MAX_SIZE}"
    echo ""
    echo "Nästa steg:"
    echo "  1. Kopiera infra/env.prod.example -> ${APP_DIR}/shared/.env"
    echo "  2. Fyll i alla miljövariabler (se kommentarer i filen)"
    echo "  3. Konfigurera SSH-nyckel för deploy-användare:"
    echo "     Se docs/CICD-SETUP.md, Del 2"
    echo "  4. Kör en deploy (CI/CD eller manuellt med infra/deploy.sh)"
    echo "  5. Initialisera databas: npx drizzle-kit push"
    echo "  6. Seeda superadmin: node scripts/seed-superadmin.js"
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
    echo " CloudPortal MSP - Server Bootstrap & Härdning"
    echo " Mål: Ubuntu 24.04 LTS"
    echo "============================================================================="
    echo ""

    check_root
    check_ubuntu

    step_system_update
    step_install_node
    step_create_user
    step_create_directories
    step_configure_sudoers
    step_create_systemd_service
    step_configure_ufw
    step_harden_ssh
    step_install_fail2ban
    step_harden_kernel
    step_configure_unattended_upgrades
    step_configure_journald
    step_install_mariadb_client
    step_copy_env_template

    print_summary
}

main "$@"
