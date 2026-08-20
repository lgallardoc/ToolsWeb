#!/usr/bin/env bash
# Toolsweb dev stack — API + UI with restart when already running.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PID_DIR="$ROOT/.toolsweb/pids"
LOG_DIR="$ROOT/.toolsweb/logs"
mkdir -p "$PID_DIR" "$LOG_DIR"

if [[ -f "$ROOT/.env" ]]; then
  # Parse KEY=VALUE without `source` — values may contain () spaces etc.
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      if [[ "$val" =~ ^\"(.*)\"$ ]]; then
        val="${BASH_REMATCH[1]}"
      elif [[ "$val" =~ ^\'(.*)\'$ ]]; then
        val="${BASH_REMATCH[1]}"
      fi
      export "${key}=${val}"
    fi
  done <"$ROOT/.env"
fi

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-${PORT:-4410}}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

port_pids() {
  lsof -ti "tcp:${1}" -sTCP:LISTEN 2>/dev/null || true
}

is_running() {
  local port="$1"
  [[ -n "$(port_pids "$port")" ]]
}

stop_port() {
  local label="$1"
  local port="$2"
  local pids
  pids="$(port_pids "$port")"
  if [[ -n "$pids" ]]; then
    echo "→ Deteniendo ${label} (puerto ${port})…"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.4
    pids="$(port_pids "$port")"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

stop_pidfile() {
  local name="$1"
  local file="$PID_DIR/${name}.pid"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$file"
  fi
}

stop_all() {
  stop_pidfile "api"
  stop_pidfile "ui"
  stop_port "API" "$BACKEND_PORT"
  stop_port "UI" "$FRONTEND_PORT"
}

ensure_deps() {
  if [[ ! -d "$ROOT/node_modules" ]]; then
    echo "→ Instalando dependencias (npm install)…"
    npm install
  fi
  if [[ ! -d "$ROOT/packages/shared/dist" ]]; then
    echo "→ Compilando @toolsweb/shared…"
    npm run build:shared
  fi
}

start_api() {
  echo "→ Iniciando API en http://${BACKEND_HOST}:${BACKEND_PORT}…"
  (
    export BACKEND_HOST BACKEND_PORT
    cd "$ROOT"
    npm run dev:api >>"$LOG_DIR/api.log" 2>&1
  ) &
  echo $! >"$PID_DIR/api.pid"
}

start_ui() {
  echo "→ Iniciando UI en http://${FRONTEND_HOST}:${FRONTEND_PORT}/…"
  (
    export FRONTEND_HOST FRONTEND_PORT BACKEND_HOST BACKEND_PORT
    cd "$ROOT"
    npm run dev:ui >>"$LOG_DIR/ui.log" 2>&1
  ) &
  echo $! >"$PID_DIR/ui.pid"
}

wait_for_health() {
  local url="http://${BACKEND_HOST}:${BACKEND_PORT}/health"
  local i
  for i in $(seq 1 40); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  echo "⚠ API no respondió en /health — revisa $LOG_DIR/api.log"
  return 1
}

cmd_start() {
  local restarted=false
  if is_running "$BACKEND_PORT" || is_running "$FRONTEND_PORT"; then
    echo "Servicios activos detectados — reiniciando…"
    stop_all
    restarted=true
  fi

  ensure_deps
  start_api
  start_ui

  if wait_for_health; then
    echo ""
    echo "Toolsweb listo."
    echo "  UI:  http://${FRONTEND_HOST}:${FRONTEND_PORT}/"
    echo "  API: http://${BACKEND_HOST}:${BACKEND_PORT}/health"
    echo "  Logs: $LOG_DIR/{api,ui}.log"
    if [[ "$restarted" == true ]]; then
      echo "  (reiniciado)"
    fi
  fi
}

cmd_status() {
  echo "Backend (${BACKEND_HOST}:${BACKEND_PORT}): $(
    is_running "$BACKEND_PORT" && echo "activo" || echo "detenido"
  )"
  echo "Frontend (${FRONTEND_HOST}:${FRONTEND_PORT}): $(
    is_running "$FRONTEND_PORT" && echo "activo" || echo "detenido"
  )"
}

usage() {
  cat <<EOF
Uso: $(basename "$0") <comando>

Comandos:
  start    Levanta API + UI (reinicia si ya están activos)
  stop     Detiene API + UI
  restart  stop + start
  status   Muestra puertos activos

Puertos desde .env: BACKEND_PORT=${BACKEND_PORT}, FRONTEND_PORT=${FRONTEND_PORT}
EOF
}

case "${1:-start}" in
  start) cmd_start ;;
  stop)
    stop_all
    echo "Toolsweb detenido."
    ;;
  restart)
    stop_all
    cmd_start
    ;;
  status) cmd_status ;;
  -h | --help | help) usage ;;
  *)
    echo "Comando desconocido: $1"
    usage
    exit 1
    ;;
esac
