#!/usr/bin/env bash
# =============================================================================
# CloudPortal MSP - Deploy & Rollback Script
# =============================================================================
# Server-side script för manuella deploys och rollback.
# Komplement till CI/CD-pipeline (GitHub Actions).
#
# Användning:
#   ./deploy.sh deploy <tarball-or-directory>   Deploy ny release
#   ./deploy.sh rollback [release-name]          Återställ till föregående
#   ./deploy.sh list                             Lista alla releases
#   ./deploy.sh health                           Kontrollera hälsostatus
#   ./deploy.sh cleanup                          Rensa gamla, behåll 5 senaste
#
# Kör som cloudportal-användaren eller som root.
# =============================================================================

set -euo pipefail

# =============================================================================
# KONFIGURATION
# =============================================================================
APP_DIR="/opt/cloudportal"
RELEASES_DIR="${APP_DIR}/releases"
SHARED_DIR="${APP_DIR}/shared"
CURRENT_LINK="${APP_DIR}/current"
ENV_FILE="${SHARED_DIR}/.env"
UPLOADS_DIR="${SHARED_DIR}/uploads"

SERVICE_NAME="cloudportal"
HEALTH_URL="http://localhost:3000/api/health"
HEALTH_RETRIES=30
HEALTH_INTERVAL=2

KEEP_RELEASES=5

# =============================================================================
# HJÄLPFUNKTIONER
# =============================================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[FEL]${NC}   $1"; }
log_step()  { echo -e "${BLUE}[STEG]${NC}  $1"; }

die() {
    log_error "$1"
    exit 1
}

get_current_release() {
    if [[ -L "$CURRENT_LINK" ]]; then
        readlink -f "$CURRENT_LINK" | xargs basename
    else
        echo ""
    fi
}

get_previous_release() {
    local current
    current=$(get_current_release)

    if [[ -z "$current" ]]; then
        echo ""
        return
    fi

    # Sortera releases, hitta den som kommer precis före current
    ls -1t "$RELEASES_DIR" 2>/dev/null | grep -A1 "^${current}$" | tail -1
}

# =============================================================================
# KOMMANDO: deploy
# =============================================================================
cmd_deploy() {
    local source="${1:-}"

    if [[ -z "$source" ]]; then
        die "Användning: $0 deploy <tarball-or-directory>"
    fi

    # Generera release-namn
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local short_hash
    short_hash=$(echo "$source" | md5sum | cut -c1-7)
    local release_name="${timestamp}_${short_hash}"
    local release_dir="${RELEASES_DIR}/${release_name}"

    log_info "========================================"
    log_info "Deploy: ${release_name}"
    log_info "========================================"

    # Spara nuvarande release för eventuell rollback
    local previous_release
    previous_release=$(get_current_release)

    # ----- Steg 1: Skapa release-katalog -----
    log_step "1/9 Skapar release-katalog..."
    mkdir -p "${release_dir}/portal"

    # ----- Steg 2: Kopiera/extrahera build-artefakter -----
    log_step "2/9 Kopierar build-artefakter..."

    if [[ -f "$source" ]]; then
        # Tarball
        case "$source" in
            *.tar.gz|*.tgz)
                tar -xzf "$source" -C "$release_dir"
                ;;
            *.tar)
                tar -xf "$source" -C "$release_dir"
                ;;
            *.zip)
                unzip -q "$source" -d "$release_dir"
                ;;
            *)
                die "Okänt arkivformat: $source (stöder .tar.gz, .tgz, .tar, .zip)"
                ;;
        esac
    elif [[ -d "$source" ]]; then
        # Katalog - kopiera innehållet
        cp -a "$source/." "$release_dir/"
    else
        die "Källan finns inte: $source"
    fi

    # ----- Steg 3: Verifiera portal/-struktur -----
    log_step "3/9 Verifierar release-struktur..."

    # Om .output finns i roten, flytta till portal/
    if [[ -d "${release_dir}/.output" && ! -d "${release_dir}/portal/.output" ]]; then
        log_info "  Flyttar .output till portal/-underkatalog..."
        mv "${release_dir}/.output" "${release_dir}/portal/.output"
    fi

    # Kopiera package.json om den finns i roten
    if [[ -f "${release_dir}/package.json" && ! -f "${release_dir}/portal/package.json" ]]; then
        cp "${release_dir}/package.json" "${release_dir}/portal/"
    fi

    # Verifiera att entry point finns
    if [[ ! -f "${release_dir}/portal/.output/server/index.mjs" ]]; then
        log_error "Entry point saknas: portal/.output/server/index.mjs"
        rm -rf "$release_dir"
        die "Ogiltig release. Kontrollera att builden lyckades."
    fi

    log_info "  Entry point bekräftad: portal/.output/server/index.mjs"

    # ----- Steg 4: Symlink .env -----
    log_step "4/9 Symlänkar .env..."

    if [[ ! -f "$ENV_FILE" ]]; then
        die ".env saknas: ${ENV_FILE}. Skapa den först (se infra/env.prod.example)."
    fi

    ln -sf "$ENV_FILE" "${release_dir}/portal/.env"
    log_info "  ${ENV_FILE} -> portal/.env"

    # ----- Steg 5: Symlink uploads -----
    log_step "5/9 Symlänkar uploads..."
    mkdir -p "$UPLOADS_DIR"
    ln -sfn "$UPLOADS_DIR" "${release_dir}/portal/uploads"
    log_info "  ${UPLOADS_DIR} -> portal/uploads"

    # ----- Steg 6: Databasmigrering -----
    log_step "6/9 Kör databasmigrering..."
    (
        cd "${release_dir}/portal"
        # Ladda miljövariabler för drizzle-kit
        set -a
        # shellcheck disable=SC1091
        source "$ENV_FILE"
        set +a
        npx drizzle-kit push --force 2>&1 | tail -5
    )
    log_info "  Databasmigrering klar"

    # ----- Steg 7: Atomic symlink-swap -----
    log_step "7/9 Byter aktiv release (atomic symlink)..."

    # ln -sfn är atomisk på Linux (rename syscall)
    ln -sfn "$release_dir" "$CURRENT_LINK"
    log_info "  current -> ${release_name}"

    # ----- Steg 8: Starta om tjänsten -----
    log_step "8/9 Startar om tjänsten..."
    sudo systemctl restart "$SERVICE_NAME"

    # ----- Steg 9: Health check -----
    log_step "9/9 Väntar på health check..."
    local healthy=false

    for i in $(seq 1 $HEALTH_RETRIES); do
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            healthy=true
            break
        fi
        echo -ne "  Försök ${i}/${HEALTH_RETRIES}...\r"
        sleep "$HEALTH_INTERVAL"
    done
    echo ""

    if $healthy; then
        log_info "========================================"
        log_info "Deploy LYCKADES: ${release_name}"
        log_info "========================================"

        # Visa hälsostatus
        curl -sf "$HEALTH_URL" 2>/dev/null | jq . 2>/dev/null || true
    else
        log_error "========================================"
        log_error "Health check MISSLYCKADES - startar auto-rollback!"
        log_error "========================================"

        if [[ -n "$previous_release" && -d "${RELEASES_DIR}/${previous_release}" ]]; then
            log_warn "Återställer till: ${previous_release}"
            ln -sfn "${RELEASES_DIR}/${previous_release}" "$CURRENT_LINK"
            sudo systemctl restart "$SERVICE_NAME"
            sleep 5

            if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
                log_info "Rollback lyckades till: ${previous_release}"
            else
                log_error "Rollback misslyckades också! Manuell åtgärd krävs."
            fi
        else
            log_error "Ingen tidigare release att rulla tillbaka till!"
            log_error "Kontrollera loggar: journalctl -u ${SERVICE_NAME} -n 50"
        fi

        exit 1
    fi
}

# =============================================================================
# KOMMANDO: rollback
# =============================================================================
cmd_rollback() {
    local target="${1:-}"

    if [[ -z "$target" ]]; then
        # Ingen release angiven - rulla tillbaka till föregående
        target=$(get_previous_release)
        if [[ -z "$target" ]]; then
            die "Ingen tidigare release att rulla tillbaka till."
        fi
    fi

    local target_dir="${RELEASES_DIR}/${target}"

    if [[ ! -d "$target_dir" ]]; then
        die "Release finns inte: ${target}"
    fi

    local current
    current=$(get_current_release)

    if [[ "$current" == "$target" ]]; then
        die "Release '${target}' är redan aktiv."
    fi

    log_info "========================================"
    log_info "Rollback: ${current} -> ${target}"
    log_info "========================================"

    # Byt symlink
    ln -sfn "$target_dir" "$CURRENT_LINK"
    log_info "current -> ${target}"

    # Starta om
    sudo systemctl restart "$SERVICE_NAME"
    log_info "Tjänsten omstartad"

    # Health check
    sleep 3
    local healthy=false
    for i in $(seq 1 10); do
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            healthy=true
            break
        fi
        sleep 2
    done

    if $healthy; then
        log_info "========================================"
        log_info "Rollback LYCKADES till: ${target}"
        log_info "========================================"
    else
        log_error "Rollback-release svarar inte på health check!"
        log_error "Kontrollera loggar: journalctl -u ${SERVICE_NAME} -n 50"
        exit 1
    fi
}

# =============================================================================
# KOMMANDO: list
# =============================================================================
cmd_list() {
    local current
    current=$(get_current_release)

    echo ""
    echo "Releases i ${RELEASES_DIR}:"
    echo "-------------------------------------------"

    if [[ ! -d "$RELEASES_DIR" ]] || [[ -z "$(ls -A "$RELEASES_DIR" 2>/dev/null)" ]]; then
        echo "  (inga releases)"
        return
    fi

    ls -1t "$RELEASES_DIR" | while read -r release; do
        local marker="  "
        if [[ "$release" == "$current" ]]; then
            marker="->"
        fi
        local size
        size=$(du -sh "${RELEASES_DIR}/${release}" 2>/dev/null | cut -f1)
        printf "  %s %-35s  %s\n" "$marker" "$release" "$size"
    done

    echo "-------------------------------------------"
    echo "  -> = aktiv release"
    echo "  Totalt: $(ls -1 "$RELEASES_DIR" | wc -l) release(s)"
    echo ""
}

# =============================================================================
# KOMMANDO: health
# =============================================================================
cmd_health() {
    echo ""
    log_info "Hälsostatus för CloudPortal MSP"
    echo "-------------------------------------------"

    # Systemd-status
    local service_status
    service_status=$(sudo systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "inactive")
    if [[ "$service_status" == "active" ]]; then
        echo -e "  Systemd-tjänst:  ${GREEN}${service_status}${NC}"
    else
        echo -e "  Systemd-tjänst:  ${RED}${service_status}${NC}"
    fi

    # Aktiv release
    local current
    current=$(get_current_release)
    echo "  Aktiv release:   ${current:-"(ingen)"}"

    # Health endpoint
    echo -n "  Health endpoint: "
    local health_response
    if health_response=$(curl -sf "$HEALTH_URL" 2>/dev/null); then
        echo -e "${GREEN}OK${NC}"
        echo ""
        echo "$health_response" | jq . 2>/dev/null || echo "$health_response"
    else
        echo -e "${RED}SVARAR INTE${NC}"
    fi

    # Diskutrymme
    echo ""
    echo "  Diskutrymme:"
    df -h "$APP_DIR" | tail -1 | awk '{printf "    Totalt: %s, Använt: %s (%s), Ledigt: %s\n", $2, $3, $5, $4}'
    echo "    Releases: $(du -sh "$RELEASES_DIR" 2>/dev/null | cut -f1)"
    echo "    Uploads:  $(du -sh "$UPLOADS_DIR" 2>/dev/null | cut -f1)"

    # Minne
    echo ""
    echo "  Processminne:"
    local pid
    pid=$(pgrep -f "node .output/server/index.mjs" 2>/dev/null | head -1 || true)
    if [[ -n "$pid" ]]; then
        ps -p "$pid" -o pid,rss,vsz,etime --no-headers | \
            awk '{printf "    PID: %s, RSS: %.0fM, VSZ: %.0fM, Körtid: %s\n", $1, $2/1024, $3/1024, $4}'
    else
        echo "    (processen körs inte)"
    fi

    echo "-------------------------------------------"
    echo ""
}

# =============================================================================
# KOMMANDO: cleanup
# =============================================================================
cmd_cleanup() {
    local current
    current=$(get_current_release)
    local count=0

    log_info "Rensar gamla releases (behåller ${KEEP_RELEASES} senaste)..."

    local releases_to_remove
    releases_to_remove=$(ls -1t "$RELEASES_DIR" 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)))

    if [[ -z "$releases_to_remove" ]]; then
        log_info "Inget att rensa. Totalt $(ls -1 "$RELEASES_DIR" | wc -l) release(s)."
        return
    fi

    echo "$releases_to_remove" | while read -r release; do
        if [[ "$release" == "$current" ]]; then
            log_warn "Hoppar över aktiv release: ${release}"
            continue
        fi
        log_info "  Tar bort: ${release}"
        rm -rf "${RELEASES_DIR:?}/${release}"
        count=$((count + 1))
    done

    log_info "Rensning klar. Kvarvarande: $(ls -1 "$RELEASES_DIR" | wc -l) release(s)."
}

# =============================================================================
# USAGE
# =============================================================================
usage() {
    echo ""
    echo "CloudPortal MSP - Deploy & Rollback"
    echo ""
    echo "Användning:"
    echo "  $0 deploy <tarball-or-directory>   Deploy ny release"
    echo "  $0 rollback [release-name]          Återställ (standard: föregående)"
    echo "  $0 list                             Lista alla releases"
    echo "  $0 health                           Kontrollera hälsostatus"
    echo "  $0 cleanup                          Rensa gamla (behåll ${KEEP_RELEASES})"
    echo ""
    echo "Exempel:"
    echo "  $0 deploy /tmp/cloudportal-build.tar.gz"
    echo "  $0 deploy /tmp/build-output/"
    echo "  $0 rollback"
    echo "  $0 rollback 20260304_120000_abc1234"
    echo ""
}

# =============================================================================
# HUVUDPROGRAM
# =============================================================================
main() {
    local command="${1:-}"
    shift || true

    case "$command" in
        deploy)
            cmd_deploy "$@"
            ;;
        rollback)
            cmd_rollback "$@"
            ;;
        list)
            cmd_list
            ;;
        health)
            cmd_health
            ;;
        cleanup)
            cmd_cleanup
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

main "$@"
