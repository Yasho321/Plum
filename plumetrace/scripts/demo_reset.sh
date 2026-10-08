#!/usr/bin/env bash
# OWNER    : Yasho2
# DUE      : D3 20:00
# TASK     :
#   Reset demo state: reject stale drafts, pin demo run_id, clear Telegram test chat noise. Run before every rehearsal.
# DONE WHEN: -
# GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
# STATUS   : DONE
#
# Usage:
#   scripts/demo_reset.sh                 # uses env below
#   PT_LOCAL=1 scripts/demo_reset.sh      # offline: just re-seed ./.local-s3
#
# Env:
#   API_URL     deployed API base (for rejecting stale drafts)
#   TOKEN       a Cognito access token in the 'admin' group (for the reject calls)
#   DEMO_RUN_ID the run_id to pin for the demo (default 2026-10-09T00Z)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_RUN_ID="${DEMO_RUN_ID:-2026-10-09T00Z}"

echo "== PlumeTrace demo reset =="
echo "pinned demo run_id : ${DEMO_RUN_ID}"

# 1) Re-seed the canonical demo data (DynamoDB+S3, or ./.local-s3 if PT_LOCAL).
echo "-- re-seeding mocks --"
python "${ROOT}/scripts/seed_mocks.py"

# 2) Reject any stale draft actions left over from a previous rehearsal so the
#    approvals queue is clean. Needs a deployed API + an admin token.
if [[ -n "${API_URL:-}" && -n "${TOKEN:-}" ]]; then
  echo "-- rejecting stale drafts via ${API_URL} --"
  drafts="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" "${API_URL}/actions?status=draft" || echo '{"actions":[]}')"
  echo "${drafts}" | python -c "import sys,json; [print(a['action_id']) for a in json.load(sys.stdin).get('actions',[])]" \
    | while read -r id; do
        [[ -z "${id}" ]] && continue
        curl -fsS -X POST -H "Authorization: Bearer ${TOKEN}" "${API_URL}/actions/${id}/reject" >/dev/null \
          && echo "   rejected ${id}" || echo "   (could not reject ${id})"
      done
else
  echo "-- skipping API draft cleanup (set API_URL + TOKEN to enable) --"
fi

# 3) Telegram test chat: nothing to delete server-side; remind the operator.
echo "-- reminder: clear the Telegram test chat and set volume up on the demo phone --"

echo "== reset complete. Pin run_id=${DEMO_RUN_ID} in the UI before the demo. =="
