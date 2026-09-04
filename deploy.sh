#!/usr/bin/env bash
# ============================================================================
# Admin-Dashboard Deploy → admin.partsunion.de
#
# 1) rsync den Quellcode auf den Server (/opt/partsunion-src/Admin-Dashboard)
# 2) admin-dashboard-Container in der Compose-Chain neu bauen + hochfahren
#
# Der Docker-Build (Admin-Dashboard/Dockerfile) führt npm install + vite build
# mit VITE_API_BASE_URL/VITE_SCRAPER_BASE_URL=https://api.partsunion.de aus
# (gesetzt in production-stack/docker-compose.full.yml) — lokal nichts vorzubauen.
#
# Nutzung:
#   ./deploy.sh partsunion               # SSH-Alias aus ~/.ssh/config
#   ./deploy.sh root@94.237.98.26        # oder Host direkt
# ============================================================================
set -euo pipefail

SERVER="${1:?Usage: ./deploy.sh user@server}"
SRC="$(cd "$(dirname "$0")" && pwd)/"
DEST="/opt/partsunion-src/Admin-Dashboard/"
CTL_DIR="/opt/partsunion-ai"
CHAIN="-f docker-compose.yml -f docker-compose.cpu.yml -f production-stack/docker-compose.full.yml --env-file secrets/.env.production"

echo "▸ 1/4  rsync  ${SRC} → ${SERVER}:${DEST}"
# node_modules/dist/.git ausgeschlossen; --delete hält den Build-Context sauber
# (verhindert, dass COPY . . im Dockerfile einen veralteten node_modules zieht).
# Test-Artefakte fliegen mit raus — sie stehen ohnehin in .dockerignore.
# dist-probe/ sind die Bildproben aus src/test/redesignAbbild.test.tsx: ein
# paar hundert Kilobyte HTML samt Schriftkopien, die auf dem Server nichts
# zu suchen haben.
rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude dist-probe \
  --exclude .git \
  --exclude '*.log' \
  --exclude e2e \
  --exclude playwright-report \
  --exclude test-results \
  --exclude test-results.xml \
  --exclude .DS_Store \
  "${SRC}" "${SERVER}:${DEST}"

# ---------------------------------------------------------------------------
# Sperrdatei prüfen, BEVOR das Image gebaut wird.
#
# Anlass: der Docker-Build nutzt node:20-alpine (npm 10.8), lokal läuft hier
# npm 11. Die beiden lösen Abhängigkeiten unterschiedlich auf. Ein `npm install`
# mit npm 11 hat 512 Zeilen aus package-lock.json entfernt — darunter das eigene
# esbuild von vitest. npm 11 fand das in Ordnung, `npm ci --dry-run` lokal
# ebenfalls; npm 10 im Build brach danach mit EUSAGE ab.
#
# Lokal ist der Fehler also NICHT zu sehen. Deshalb wird hier mit derselben
# npm-Version geprüft, die auch baut — das kostet ein paar Sekunden und ersetzt
# einen Image-Build, der erst nach über einer Minute scheitert.
#
# Wenn es hier klemmt: die Sperrdatei mit npm 20 neu erzeugen, nicht lokal.
#   docker run --rm -v "$PWD:/w" -w /w node:20-alpine npm install --package-lock-only
# ---------------------------------------------------------------------------
echo "▸ 2/4  package-lock.json gegen npm 10 prüfen (dieselbe Version wie im Build)"
ssh "${SERVER}" "set -e
  rm -rf /tmp/lockcheck && mkdir -p /tmp/lockcheck
  cp ${DEST}package.json ${DEST}package-lock.json /tmp/lockcheck/
  docker run --rm -v /tmp/lockcheck:/w -w /w node:20-alpine \
    npm ci --dry-run --no-audit --no-fund --no-progress >/tmp/lockcheck/out 2>&1 || {
      echo '  ✗ package-lock.json passt nicht zu package.json (npm 10):'
      grep -m8 'npm error' /tmp/lockcheck/out | sed 's/^/    /'
      echo '    → neu erzeugen mit:'
      echo '      docker run --rm -v \"\$PWD:/w\" -w /w node:20-alpine npm install --package-lock-only'
      rm -rf /tmp/lockcheck
      exit 1
    }
  rm -rf /tmp/lockcheck
  echo '  ✓ Sperrdatei ist gültig'"

echo "▸ 3/4  rebuild admin-dashboard auf ${SERVER}"
ssh "${SERVER}" "cd ${CTL_DIR} && docker compose ${CHAIN} build admin-dashboard && docker compose ${CHAIN} up -d admin-dashboard"

echo "▸ 4/4  Status"
ssh "${SERVER}" "docker ps --filter name=admin-dashboard --format '  {{.Names}}  {{.Status}}'"

echo "✓ fertig — prüfe https://admin.partsunion.de (ggf. Hard-Reload / Cache leeren)"
