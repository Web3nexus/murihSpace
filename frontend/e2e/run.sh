#!/usr/bin/env bash
# One-command end-to-end run against the REAL Laravel API and the real Vite app.
#   cd web/frontend && bash e2e/run.sh
# Uses an isolated SQLite DB (web/backend/database/e2e.sqlite). Never touches the dev PostgreSQL DB.
# The web app signs in with the httpOnly session cookie. The app and API share 127.0.0.1, so the
# cookie is same-site, the web origin is listed as Sanctum stateful (so login returns no token),
# and the session driver must persist between requests (not "array").
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$(cd "$HERE/.." && pwd)"
BACKEND="$(cd "$FRONTEND/../backend" && pwd)"
SKILL="${WEBAPP_TESTING_SKILL:-$HOME/.claude/skills/webapp-testing}"
API_PORT="${API_PORT:-8100}"
WEB_PORT="${WEB_PORT:-5190}"

cd "$FRONTEND"
python3 e2e/prepare_backend.py

python3 "$SKILL/scripts/with_server.py" \
  --server "cd $BACKEND && DB_CONNECTION=sqlite DB_DATABASE=$BACKEND/database/e2e.sqlite BROADCAST_CONNECTION=null CACHE_STORE=array QUEUE_CONNECTION=sync SESSION_DRIVER=file CORS_ALLOWED_ORIGINS=http://127.0.0.1:$WEB_PORT SANCTUM_STATEFUL_DOMAINS=localhost,localhost:$WEB_PORT,127.0.0.1,127.0.0.1:$WEB_PORT,127.0.0.1:8000,::1 PHP_CLI_SERVER_WORKERS=8 php -S 127.0.0.1:$API_PORT -t public" --port "$API_PORT" \
  --server "VITE_API_BASE_URL=http://127.0.0.1:$API_PORT/api/v1 npx vite --host 127.0.0.1 --port $WEB_PORT --strictPort" --port "$WEB_PORT" \
  --timeout 120 \
  -- env BASE_URL="http://127.0.0.1:$WEB_PORT" API_URL="http://127.0.0.1:$API_PORT/api/v1" python3 e2e/smoke.py
