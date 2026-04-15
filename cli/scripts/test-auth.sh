#!/usr/bin/env bash
#
# test-auth.sh -- Authenticate a company with ANAF via the callback server flow.
#
# Prerequisite: run test-setup.sh first.
#
# If the CLI already has a fresh token for the correct CUI in test mode,
# this script skips the browser login and exits immediately.
#
# Otherwise, it opens your browser to ANAF's OAuth page. After you
# authenticate with your USB certificate, the CLI catches the callback
# automatically.
#
set -euo pipefail

CLI="${CLI:-node dist/bin/anaf-cli.cjs}"

: "${ANAF_CUI:?Set ANAF_CUI}"

# ── Check if already authenticated in test mode ─────────────────────
WHOAMI_JSON=$($CLI --format json auth whoami 2>/dev/null || echo '{}')

CURRENT_CUI=$(echo "$WHOAMI_JSON" | grep -o '"cui":"[^"]*"' | cut -d'"' -f4 2>/dev/null || true)
CURRENT_ENV=$(echo "$WHOAMI_JSON" | grep -o '"env":"[^"]*"' | cut -d'"' -f4 2>/dev/null || true)
TOKEN_STATUS=$(echo "$WHOAMI_JSON" | grep -o '"tokenStatus":"[^"]*"' | cut -d'"' -f4 2>/dev/null || true)

if [ "$CURRENT_CUI" = "$ANAF_CUI" ] && [ "$CURRENT_ENV" = "test" ] && [ "$TOKEN_STATUS" = "fresh" ]; then
  echo "==> Already authenticated for $ANAF_CUI in test mode (token fresh). Skipping login."
  $CLI auth whoami
  exit 0
fi

# ── Verify we are in test mode ──────────────────────────────────────
if [ -n "$CURRENT_ENV" ] && [ "$CURRENT_ENV" != "test" ]; then
  echo "ERROR: Environment is '$CURRENT_ENV', expected 'test'."
  echo "       Re-run test-setup.sh with ENV=test first."
  exit 1
fi

# ── Login ────────────────────────────────────────────────────────────
echo "==> Logging in for company: $ANAF_CUI"
echo "    Your browser will open to ANAF's login page."
echo "    Insert your USB certificate and approve access."
echo ""

$CLI auth login "$ANAF_CUI"

echo ""
echo "==> Token status:"
$CLI auth whoami

echo ""
echo "Done. You can now run './scripts/test-operations.sh'."
