#!/usr/bin/env bash
# OWNER    : Yasho2
# TASK     : One-command local demo — MOCK_MODE API (:8080) + web (:5173), no AWS/keys.
# STATUS   : DONE
#
# Usage:  scripts/demo_local.sh     (Ctrl+C stops both)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== PlumeTrace local demo (no AWS, no keys) =="

# 1. API in MOCK_MODE (serves contracts/mocks + the Copilot SSE replay)
( cd "$ROOT/api" && MOCK_MODE=1 PORT=8080 bun run dev ) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT INT TERM

# 2. Wait for the API health check
echo -n "waiting for API on :8080 "
for _ in $(seq 1 60); do
  if curl -sf http://localhost:8080/health >/dev/null 2>&1; then echo "-> up"; break; fi
  echo -n "."; sleep 0.5
done

# 3. Web dev server (uses web/.env.local: VITE_DEV_NOAUTH -> local admin, no Cognito)
echo "starting web on :5173 — open http://localhost:5173"
cd "$ROOT/web" && npm run dev
