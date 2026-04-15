#!/usr/bin/env bash
#
# test-all.sh -- Full integration test: setup, authenticate, and run operations.
#
# Required env vars:
#   ANAF_CLIENT_ID
#   ANAF_CLIENT_SECRET
#   ANAF_CUI
#
# Usage:
#   export ANAF_CLIENT_ID=abc...
#   export ANAF_CLIENT_SECRET=xyz...
#   export ANAF_CUI=12345678
#   ./scripts/test-all.sh
#
# You can override the CLI binary path:
#   CLI="npx anaf-cli" ./scripts/test-all.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo " ANAF CLI - Full Integration Test"
echo "============================================"
echo ""

# Step 1: Build (if running from source)
if [ -f "$SCRIPT_DIR/../package.json" ] && [ -z "${SKIP_BUILD:-}" ]; then
  echo "==> Building CLI from source..."
  cd "$SCRIPT_DIR/.."
  pnpm build 2>&1 | tail -3
  export CLI="node dist/bin/anaf-cli.cjs"
  echo ""
fi

# Step 2: Setup
"$SCRIPT_DIR/test-setup.sh"
echo ""

# Step 3: Auth (requires browser interaction)
"$SCRIPT_DIR/test-auth.sh"
echo ""

# Step 4: Operations
"$SCRIPT_DIR/test-operations.sh"
echo ""

# Step 5: UBL invoice generation tests
"$SCRIPT_DIR/test-ubl.sh"
