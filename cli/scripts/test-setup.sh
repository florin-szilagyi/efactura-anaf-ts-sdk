#!/usr/bin/env bash
#
# test-setup.sh -- Set up OAuth credentials for local testing.
#
# Required env vars:
#   ANAF_CLIENT_ID
#   ANAF_CLIENT_SECRET
#
# Usage:
#   export ANAF_CLIENT_ID=abc...
#   export ANAF_CLIENT_SECRET=xyz...
#   ./scripts/test-setup.sh
#
set -euo pipefail

CLI="${CLI:-node dist/bin/anaf-cli.cjs}"
ENV="${ENV:-test}"

# ── Validate env ──────────────────────────────────────────────────────
: "${ANAF_CLIENT_ID:?Set ANAF_CLIENT_ID}"
: "${ANAF_CLIENT_SECRET:?Set ANAF_CLIENT_SECRET}"

echo "==> Cleaning up previous state..."
$CLI cred clear 2>/dev/null || true

echo ""
echo "==> Saving credential"
$CLI cred set \
  --client-id "$ANAF_CLIENT_ID" \
  --client-secret "$ANAF_CLIENT_SECRET" \
  --redirect-uri https://localhost:9002/callback \
  --env "$ENV"

echo ""
echo "==> Current credential:"
$CLI cred show

echo ""
echo "Done. Run './scripts/test-auth.sh' next to authenticate (opens browser)."
