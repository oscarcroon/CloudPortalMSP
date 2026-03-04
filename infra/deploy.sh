#!/usr/bin/env bash
# =============================================================================
# CloudPortal MSP - Deploy & Rollback Script
# =============================================================================
# Server-side script för deploy, rollback och underhåll.
# Kan användas standalone (hämtar från git) eller som del av CI/CD.
#
# Användning:
#   ./deploy.sh upgrade                          Hämta senaste från git, bygg & deploya
#   ./deploy.sh upgrade <branch|tag|commit>      Deploya specifik version
#   ./deploy.sh deploy <tarball-or-directory>    Deploya från förbyggd artefakt
#   ./deploy.sh rollback [release-name]          Återställ till föregående release
#   ./deploy.sh list                             Lista alla releases
#   ./deploy.sh health                           Kontrollera hälsostatus
#   ./deploy.sh cleanup                          Rensa gamla, behåll 5 senaste
#   ./deploy.sh logs [antal]                     Visa senaste loggar
#
# Se docs/DEPLOY.md för detaljerad dokumentation.
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
BUILD_DIR="${APP_DIR}/.build-workspace"

SERVICE_NAME="cloudportal"
HEALTH_URL="http://localhost:3000/api/health"
HEALTH_RETRIES=30
HEALTH_INTERVAL=2

KEEP_RELEASES=5

# Git-konfiguration
GIT_REPO="https://github.com/orgiz/CloudPortalMSP.git"

# Automatisk branch-detektering baserat på NODE_ENV i .env
# Kan åsidosättas med argument: ./deploy.sh upgrade <branch>
detect_branch() {
    local node_env=""
    if [[ -f "$ENV_FILE" ]]; then
        node_env=$(grep -E "^NODE_ENV=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d ' "'"'" || true)
    fi

    case "$node_env" in
        production)  echo "main" ;;
        *)           echo "dev" ;;
    esac
}

# =============================================================================
# HJÄLPFUNKTIONER
# =============================================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
    ls -1t "$RELEASES_DIR" 2>/dev/null | awk -v current="$current" '
        $0 == current {
            if (getline next_release) {
                print next_release
            }
            exit
        }
    '
}

# Gemensam funktion som kör steg 3-9 (symlinks, migration, swap, restart, health)
# Argument: $1 = release_dir, $2 = release_name
activate_release() {
    local release_dir="$1"
    local release_name="$2"

    # Spara nuvarande release för eventuell rollback
    local previous_release
    previous_release=$(get_current_release)

    # ----- Verifiera portal/-struktur -----
    log_step "Verifierar release-struktur..."

    # Om .output finns i roten, flytta till portal/
    if [[ -d "${release_dir}/.output" && ! -d "${release_dir}/portal/.output" ]]; then
        log_info "  Flyttar .output till portal/-underkatalog..."
        mkdir -p "${release_dir}/portal"
        mv "${release_dir}/.output" "${release_dir}/portal/.output"
    fi

    # Kopiera package.json om den finns i roten men inte i portal/
    if [[ -f "${release_dir}/package.json" && ! -f "${release_dir}/portal/package.json" ]]; then
        mkdir -p "${release_dir}/portal"
        cp "${release_dir}/package.json" "${release_dir}/portal/"
    fi

    # Verifiera att entry point finns
    if [[ ! -f "${release_dir}/portal/.output/server/index.mjs" ]]; then
        log_error "Entry point saknas: portal/.output/server/index.mjs"
        rm -rf "$release_dir"
        die "Ogiltig release. Kontrollera att builden lyckades."
    fi

    log_info "  Entry point: portal/.output/server/index.mjs"

    # ----- Symlink .env -----
    log_step "Symlänkar .env..."

    if [[ ! -f "$ENV_FILE" ]]; then
        die ".env saknas: ${ENV_FILE}. Skapa den först (se infra/env.prod.example)."
    fi

    ln -sf "$ENV_FILE" "${release_dir}/portal/.env"
    log_info "  ${ENV_FILE} -> portal/.env"

    # ----- Symlink uploads -----
    log_step "Symlänkar uploads..."
    mkdir -p "$UPLOADS_DIR"
    ln -sfn "$UPLOADS_DIR" "${release_dir}/portal/uploads"
    log_info "  ${UPLOADS_DIR} -> portal/uploads"

    # ----- Databasmigrering -----
    log_step "Kör databasmigrering..."
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

    # ----- Atomic symlink-swap -----
    log_step "Byter aktiv release (atomic symlink)..."
    ln -sfn "$release_dir" "$CURRENT_LINK"
    log_info "  current -> ${release_name}"

    # ----- Starta om tjänsten -----
    log_step "Startar om tjänsten..."
    sudo systemctl restart "$SERVICE_NAME"

    # ----- Health check -----
    log_step "Väntar på health check..."
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
        echo ""

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
                log_info "Auto-rollback lyckades till: ${previous_release}"
            else
                log_error "Auto-rollback misslyckades också! Manuell åtgärd krävs."
                log_error "Kontrollera loggar: journalctl -u ${SERVICE_NAME} -n 100"
            fi
        else
            log_error "Ingen tidigare release att rulla tillbaka till!"
            log_error "Kontrollera loggar: journalctl -u ${SERVICE_NAME} -n 100"
        fi

        exit 1
    fi
}

# =============================================================================
# KOMMANDO: upgrade  (hämta från git, bygg, deploya)
# =============================================================================
cmd_upgrade() {
    local ref="${1:-}"
    local branch

    # Bestäm vilken branch/tag/commit att använda
    if [[ -n "$ref" ]]; then
        branch="$ref"
    else
        branch=$(detect_branch)
    fi

    log_info "========================================"
    log_info "Upgrade från git"
    log_info "  Repo:   ${GIT_REPO}"
    log_info "  Ref:    ${branch}"
    log_info "========================================"
    echo ""

    # ----- Steg 1: Klona/uppdatera repo -----
    log_step "1/6 Hämtar källkod från git..."

    # Rensa eventuell gammal build-workspace
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    # Shallow clone för snabbhet (bara senaste commit)
    git clone --depth 1 --branch "$branch" "$GIT_REPO" "$BUILD_DIR" 2>&1 | tail -3

    # Hämta commit-info
    local commit_hash
    commit_hash=$(git -C "$BUILD_DIR" rev-parse --short=7 HEAD)
    local commit_msg
    commit_msg=$(git -C "$BUILD_DIR" log -1 --format="%s" | cut -c1-60)

    log_info "  Commit: ${commit_hash} - ${commit_msg}"

    # ----- Steg 2: Installera beroenden -----
    log_step "2/6 Installerar beroenden (npm ci)..."

    (cd "$BUILD_DIR" && npm ci 2>&1 | tail -3)

    log_info "  Beroenden installerade"

    # ----- Steg 3: Bygga applikationen -----
    log_step "3/6 Bygger applikationen (npm run build)..."

    (cd "$BUILD_DIR" && npm run build 2>&1 | tail -5)

    # Verifiera att builden lyckades
    if [[ ! -f "${BUILD_DIR}/portal/.output/server/index.mjs" ]]; then
        rm -rf "$BUILD_DIR"
        die "Bygget misslyckades - .output/server/index.mjs saknas"
    fi

    log_info "  Bygge klart"

    # ----- Steg 4: Skapa release-katalog -----
    log_step "4/6 Skapar release..."

    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local release_name="${timestamp}_${commit_hash}"
    local release_dir="${RELEASES_DIR}/${release_name}"

    mkdir -p "${release_dir}/portal"

    # Kopiera bara det som behövs (.output + package.json)
    cp -a "${BUILD_DIR}/portal/.output" "${release_dir}/portal/.output"
    cp "${BUILD_DIR}/portal/package.json" "${release_dir}/portal/" 2>/dev/null || true

    # Kopiera drizzle-konfiguration (behövs för migrering)
    cp "${BUILD_DIR}/portal/drizzle.config.ts" "${release_dir}/portal/" 2>/dev/null || true

    # Kopiera node_modules som krävs av drizzle-kit
    if [[ -d "${BUILD_DIR}/node_modules" ]]; then
        cp -a "${BUILD_DIR}/node_modules" "${release_dir}/node_modules" 2>/dev/null || true
    fi
    if [[ -d "${BUILD_DIR}/portal/node_modules" ]]; then
        cp -a "${BUILD_DIR}/portal/node_modules" "${release_dir}/portal/node_modules" 2>/dev/null || true
    fi

    log_info "  Release: ${release_name}"

    # ----- Steg 5: Rensa build-workspace -----
    log_step "5/6 Rensar build-workspace..."
    rm -rf "$BUILD_DIR"

    # ----- Steg 6: Aktivera release -----
    log_step "6/6 Aktiverar release..."
    activate_release "$release_dir" "$release_name"

    # Automatisk cleanup
    cmd_cleanup_quiet
}

# =============================================================================
# KOMMANDO: deploy  (från förbyggd artefakt)
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
    log_info "Deploy från artefakt: ${release_name}"
    log_info "========================================"
    echo ""

    # Skapa release-katalog
    log_step "Skapar release-katalog..."
    mkdir -p "${release_dir}/portal"

    # Kopiera/extrahera build-artefakter
    log_step "Kopierar build-artefakter..."

    if [[ -f "$source" ]]; then
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
        cp -a "$source/." "$release_dir/"
    else
        die "Källan finns inte: $source"
    fi

    # Aktivera release (symlinks, migration, swap, restart, health)
    activate_release "$release_dir" "$release_name"

    # Automatisk cleanup
    cmd_cleanup_quiet
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
        # Kanske bara en del av namnet angavs - försök matcha
        local match
        match=$(ls -1t "$RELEASES_DIR" 2>/dev/null | grep "$target" | head -1 || true)
        if [[ -n "$match" ]]; then
            target="$match"
            target_dir="${RELEASES_DIR}/${target}"
        else
            die "Release finns inte: ${target}. Kör '$0 list' för att se tillgängliga."
        fi
    fi

    local current
    current=$(get_current_release)

    if [[ "$current" == "$target" ]]; then
        die "Release '${target}' är redan aktiv."
    fi

    log_info "========================================"
    log_info "Rollback"
    log_info "  Från: ${current}"
    log_info "  Till: ${target}"
    log_info "========================================"
    echo ""

    # Byt symlink
    log_step "Byter aktiv release..."
    ln -sfn "$target_dir" "$CURRENT_LINK"
    log_info "  current -> ${target}"

    # Starta om
    log_step "Startar om tjänsten..."
    sudo systemctl restart "$SERVICE_NAME"

    # Health check
    log_step "Väntar på health check..."
    local healthy=false
    for i in $(seq 1 15); do
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            healthy=true
            break
        fi
        echo -ne "  Försök ${i}/15...\r"
        sleep 2
    done
    echo ""

    if $healthy; then
        log_info "========================================"
        log_info "Rollback LYCKADES till: ${target}"
        log_info "========================================"
        echo ""
        curl -sf "$HEALTH_URL" 2>/dev/null | jq . 2>/dev/null || true
    else
        log_error "Rollback-release svarar inte på health check!"
        log_error "Kontrollera loggar: journalctl -u ${SERVICE_NAME} -n 100"
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
    echo -e "${CYAN}Releases i ${RELEASES_DIR}:${NC}"
    echo "-----------------------------------------------------------"

    if [[ ! -d "$RELEASES_DIR" ]] || [[ -z "$(ls -A "$RELEASES_DIR" 2>/dev/null)" ]]; then
        echo "  (inga releases)"
        echo ""
        return
    fi

    printf "  %-3s %-38s %s\n" "" "RELEASE" "STORLEK"
    echo "  --- -------------------------------------- --------"

    ls -1t "$RELEASES_DIR" | while read -r release; do
        local marker="   "
        if [[ "$release" == "$current" ]]; then
            marker=" ->"
        fi
        local size
        size=$(du -sh "${RELEASES_DIR}/${release}" 2>/dev/null | cut -f1)
        printf "  %s %-38s %s\n" "$marker" "$release" "$size"
    done

    echo "-----------------------------------------------------------"
    echo "  -> = aktiv release"
    echo "  Totalt: $(ls -1 "$RELEASES_DIR" | wc -l) release(s)"
    echo ""
}

# =============================================================================
# KOMMANDO: health
# =============================================================================
cmd_health() {
    echo ""
    echo -e "${CYAN}Hälsostatus - CloudPortal MSP${NC}"
    echo "-----------------------------------------------------------"

    # Systemd-status
    local service_status
    service_status=$(sudo systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "inactive")
    if [[ "$service_status" == "active" ]]; then
        echo -e "  Tjänst:          ${GREEN}${service_status}${NC}"
    else
        echo -e "  Tjänst:          ${RED}${service_status}${NC}"
    fi

    # Miljö
    local node_env=""
    if [[ -f "$ENV_FILE" ]]; then
        node_env=$(grep -E "^NODE_ENV=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d ' "'"'" || true)
    fi
    echo "  Miljö:           ${node_env:-"(okänd)"}"
    echo "  Branch:          $(detect_branch)"

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

    echo "-----------------------------------------------------------"
    echo ""
}

# =============================================================================
# KOMMANDO: logs
# =============================================================================
cmd_logs() {
    local lines="${1:-50}"
    sudo journalctl -u "$SERVICE_NAME" -n "$lines" --no-pager
}

# =============================================================================
# KOMMANDO: cleanup (tyst version för automatisk körning)
# =============================================================================
cmd_cleanup_quiet() {
    local current
    current=$(get_current_release)

    local releases_to_remove
    releases_to_remove=$(ls -1t "$RELEASES_DIR" 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)))

    if [[ -z "$releases_to_remove" ]]; then
        return
    fi

    echo "$releases_to_remove" | while read -r release; do
        if [[ "$release" == "$current" ]]; then
            continue
        fi
        rm -rf "${RELEASES_DIR:?}/${release}"
    done
}

# =============================================================================
# KOMMANDO: cleanup (med output)
# =============================================================================
cmd_cleanup() {
    local current
    current=$(get_current_release)

    log_info "Rensar gamla releases (behåller ${KEEP_RELEASES} senaste)..."

    local releases_to_remove
    releases_to_remove=$(ls -1t "$RELEASES_DIR" 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)))

    if [[ -z "$releases_to_remove" ]]; then
        log_info "Inget att rensa. Totalt $(ls -1 "$RELEASES_DIR" 2>/dev/null | wc -l) release(s)."
        return
    fi

    local count=0
    echo "$releases_to_remove" | while read -r release; do
        if [[ "$release" == "$current" ]]; then
            log_warn "Hoppar över aktiv release: ${release}"
            continue
        fi
        log_info "  Tar bort: ${release}"
        rm -rf "${RELEASES_DIR:?}/${release}"
        count=$((count + 1))
    done

    log_info "Rensning klar. Kvarvarande: $(ls -1 "$RELEASES_DIR" 2>/dev/null | wc -l) release(s)."
}

# =============================================================================
# USAGE
# =============================================================================
usage() {
    echo ""
    echo -e "${CYAN}CloudPortal MSP - Deploy & Rollback${NC}"
    echo ""
    echo "Användning:"
    echo "  $0 upgrade [branch|tag|commit]       Hämta från git, bygg & deploya"
    echo "  $0 deploy <tarball-or-directory>      Deploya förbyggd artefakt"
    echo "  $0 rollback [release-name]            Återställ (standard: föregående)"
    echo "  $0 list                               Lista alla releases"
    echo "  $0 health                             Kontrollera hälsostatus"
    echo "  $0 cleanup                            Rensa gamla (behåll ${KEEP_RELEASES})"
    echo "  $0 logs [antal]                       Visa senaste loggar"
    echo ""
    echo "Exempel:"
    echo ""
    echo "  # Hämta senaste versionen (auto-detekterar branch baserat på NODE_ENV)"
    echo "  $0 upgrade"
    echo ""
    echo "  # Hämta specifik branch, tag eller commit"
    echo "  $0 upgrade main"
    echo "  $0 upgrade dev"
    echo "  $0 upgrade v1.2.0"
    echo ""
    echo "  # Deploya från förbyggd artefakt"
    echo "  $0 deploy /tmp/cloudportal-build.tar.gz"
    echo ""
    echo "  # Rulla tillbaka till föregående release"
    echo "  $0 rollback"
    echo ""
    echo "  # Rulla tillbaka till specifik release"
    echo "  $0 list"
    echo "  $0 rollback 20260304_120000_abc1234"
    echo ""
    echo "Se docs/DEPLOY.md för detaljerad dokumentation."
    echo ""
}

# =============================================================================
# HUVUDPROGRAM
# =============================================================================
main() {
    local command="${1:-}"
    shift || true

    case "$command" in
        upgrade)
            cmd_upgrade "$@"
            ;;
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
        logs)
            cmd_logs "$@"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

main "$@"
