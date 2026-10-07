#!/usr/bin/env bash
# Local development stack that keeps running after the terminal (or an AI
# session) that started it goes away.
#
#   scripts/dev-stack.sh start    # Postgres + Redis + API (:8082) + Expo (:8081)
#   scripts/dev-stack.sh stop
#   scripts/dev-stack.sh status
#   scripts/dev-stack.sh logs api|expo
#
# The API connects as the restricted nsa_app role so row-level security is
# enforced locally exactly as in production. Logs: .dev-stack/*.log
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/.dev-stack"
mkdir -p "$STATE"
DB_NAME=${DEV_DB_NAME:-nigeria_security}
APP_PASSWORD=${NSA_APP_DEV_PASSWORD:-nsa_app_local_dev}
OWNER_URL="postgres://$(whoami)@localhost:5432/$DB_NAME"
APP_URL="postgres://nsa_app:${APP_PASSWORD}@localhost:5432/$DB_NAME"
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)

load_node() {
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null
}

running() { [ -f "$STATE/$1.pid" ] && kill -0 "$(cat "$STATE/$1.pid")" 2>/dev/null; }

start_bg() { # name, dir, command...
  local name=$1 dir=$2; shift 2
  if running "$name"; then echo "  $name already running (pid $(cat "$STATE/$name.pid"))"; return; fi
  # New session (setsid) so the process is not in the launching shell's process
  # group and survives that shell/terminal/agent session ending.
  (cd "$dir" && nohup python3 -c 'import os,sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' "$@" \
    >"$STATE/$name.log" 2>&1 </dev/null & echo $! >"$STATE/$name.pid")
  echo "  $name started (pid $(cat "$STATE/$name.pid")), log: .dev-stack/$name.log"
}

cmd_start() {
  load_node
  echo "Services:"
  brew services start postgresql@14 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1 || true
  brew services start redis >/dev/null 2>&1 || true
  until pg_isready -h localhost -q; do sleep 1; done
  echo "  postgres ready; redis $(redis-cli ping 2>/dev/null || echo unavailable)"

  echo "Database:"
  createdb -h localhost "$DB_NAME" 2>/dev/null || true
  (cd "$ROOT" && DATABASE_URL="$OWNER_URL" pnpm --filter @workspace/db run migrate >/dev/null) && echo "  migrations applied"
  psql -h localhost -d "$DB_NAME" -qc "ALTER ROLE nsa_app LOGIN PASSWORD '$APP_PASSWORD'" && echo "  nsa_app role enabled (RLS enforced)"

  echo "Build:"
  (cd "$ROOT/artifacts/api-server" && pnpm run build >/dev/null) && echo "  api built"

  echo "Processes:"
  start_bg api "$ROOT/artifacts/api-server" env NODE_ENV=development PORT=8082 \
    DATABASE_URL="$APP_URL" REDIS_URL=redis://localhost:6379/0 \
    ${SENTRY_DSN:+SENTRY_DSN="$SENTRY_DSN"} \
    node --enable-source-maps ./dist/index.mjs
  start_bg expo "$ROOT/artifacts/mobile" env CI=1 EXPO_PUBLIC_USE_API=true \
    EXPO_PUBLIC_API_BASE_URL="http://$LAN_IP:8082/api" REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP" \
    pnpm exec expo start --port 8081 --lan
  echo
  echo "API:   http://localhost:8082/api/healthz"
  echo "Web:   http://localhost:8081"
  echo "Phone: exp://$LAN_IP:8081  (same Wi-Fi)"
}

cmd_stop() {
  for name in expo api; do
    if running "$name"; then kill "$(cat "$STATE/$name.pid")" && echo "  $name stopped"; fi
    rm -f "$STATE/$name.pid"
  done
  # Expo spawns children; make sure the ports are free.
  for port in 8081 8082; do lsof -ti "tcp:$port" | xargs kill 2>/dev/null || true; done
}

cmd_status() {
  for name in api expo; do
    if running "$name"; then echo "  $name: running (pid $(cat "$STATE/$name.pid"))"; else echo "  $name: stopped"; fi
  done
  echo "  healthz: $(curl -s --max-time 3 http://localhost:8082/api/healthz || echo unreachable)"
  echo "  metro:   $(curl -s --max-time 3 http://localhost:8081/status || echo unreachable)"
}

case "${1:-status}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status) cmd_status ;;
  logs) tail -n 100 -f "$STATE/${2:-api}.log" ;;
  *) echo "usage: $0 start|stop|restart|status|logs [api|expo]"; exit 1 ;;
esac
