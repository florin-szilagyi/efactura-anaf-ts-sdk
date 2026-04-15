#!/usr/bin/env bash
#
# test-ubl.sh -- Integration tests for UBL invoice generation and ANAF validation.
#
# Prerequisite: run test-setup.sh and test-auth.sh first (or have valid auth).
#
# This script exercises:
#   1.  Auth pre-check (whoami)
#   2.  Basic single-line invoice build + validate
#   3.  Multi-line invoice build + validate
#   4.  Invoice with all supplier/customer overrides
#   5.  Invoice with optional fields (due-date, iban, note, currency)
#   6.  Invoice from YAML file
#   7.  Invoice from JSON file
#   8.  JSON output mode (--format json)
#   9.  Build + Inspect round-trip
#  10.  Edge cases (zero-tax, single-char, large qty, custom unitCode, mixed rates)
#  11+. Upload to ANAF test environment + status check (skipped when env != test)
#
set -euo pipefail

CLI="${CLI:-node dist/bin/anaf-cli.cjs}"
ANAF_CUI="${ANAF_CUI:?Set ANAF_CUI}"
# Customer CUI for test invoices. Defaults to the supplier's own CUI (self-invoice),
# which is always valid since we know it exists in ANAF. Override with a different
# real CUI if available.
CUSTOMER_CUI="${ANAF_CUSTOMER_CUI:-$ANAF_CUI}"

TMPDIR_TEST=$(mktemp -d /tmp/test-ubl-XXXXXX)
trap 'rm -rf "$TMPDIR_TEST"' EXIT
$CLI cred set --env test
PASSED=0
FAILED=0

# ── Helpers ──────────────────────────────────────────────────────────

validate_xml() {
  $CLI efactura validate --xml "$1"
}

run_test() {
  local name="$1"; shift
  echo ""
  echo "--- TEST: $name"
  if ( set -e; "$@" ) 2>&1 | sed 's/^/    /'; then
    echo "    PASS"
    PASSED=$((PASSED + 1))
  else
    echo "    FAIL"
    FAILED=$((FAILED + 1))
  fi
}

# ── Auth pre-check ───────────────────────────────────────────────────

echo "============================================"
echo " ANAF CLI - UBL Invoice Integration Tests"
echo "============================================"
echo ""

echo "==> Checking authentication status"
if ! $CLI auth whoami >/dev/null 2>&1; then
  echo ""
  echo "    Not authenticated. Run test-auth.sh first."
  echo "    Skipping UBL tests (this is not an error)."
  echo ""
  exit 0
fi
echo "    Authenticated."

# ── Test cases ───────────────────────────────────────────────────────

test_basic_single_line() {
  local out="$TMPDIR_TEST/basic.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-001 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Consultanta IT|1|100|21" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_multi_line() {
  local out="$TMPDIR_TEST/multi.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-002 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Consultanta IT|10|250|21" \
    --line "Hardware laptop|2|1500|21" \
    --line "Servicii mentenanta|5|75|21" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_all_overrides() {
  local out="$TMPDIR_TEST/overrides.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-003 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu|1|500|21" \
    --supplier-name "Override Supplier SRL" \
    --supplier-street "Str. Override 10" \
    --supplier-city "Timisoara" \
    --supplier-postal-zone "300001" \
    --supplier-country-code "RO" \
    --customer-name "Override Customer SRL" \
    --customer-street "Bd. Clientului 5" \
    --customer-city "Iasi" \
    --customer-postal-zone "700001" \
    --customer-country-code "RO" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_optional_fields() {
  local out="$TMPDIR_TEST/optional.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-004 \
    --issue-date 2026-04-13 \
    --due-date 2026-05-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu complet|1|1000|21" \
    --currency RON \
    --payment-iban RO49AAAA1B31007593840000 \
    --note "Plata in 30 de zile" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_from_yaml() {
  local yaml="$TMPDIR_TEST/invoice.yaml"
  local out="$TMPDIR_TEST/from-yaml.xml"
  # Unquoted delimiter so $CUSTOMER_CUI expands
  cat > "$yaml" << YAMLEOF
invoiceNumber: TEST-UBL-005
issueDate: "2026-04-13"
customerCui: "$CUSTOMER_CUI"
lines:
  - description: Serviciu YAML obiect
    quantity: 3
    unitPrice: 200
    taxPercent: 21
  - "Produs YAML pipe|1|50|21"
currency: RON
YAMLEOF
  $CLI ubl build --from-yaml "$yaml" --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_from_json() {
  local json="$TMPDIR_TEST/invoice.json"
  local out="$TMPDIR_TEST/from-json.xml"
  # Unquoted delimiter so $CUSTOMER_CUI expands
  cat > "$json" << JSONEOF
{
  "invoiceNumber": "TEST-UBL-006",
  "issueDate": "2026-04-13",
  "customerCui": "$CUSTOMER_CUI",
  "lines": [
    {
      "description": "Serviciu JSON",
      "quantity": 2,
      "unitPrice": 300,
      "taxPercent": 21
    }
  ],
  "currency": "RON"
}
JSONEOF
  $CLI ubl build --from-json "$json" --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_json_output() {
  local out="$TMPDIR_TEST/json-out.xml"
  local result
  result=$($CLI --format json ubl build \
    --invoice-number TEST-UBL-007 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu JSON mode|1|100|21" \
    --out "$out")
  # Verify JSON envelope has expected fields
  echo "$result" | grep -q '"invoiceNumber"'
  echo "$result" | grep -q '"xml"'
  echo "$result" | grep -q '"xmlLength"'
  test -f "$out"
  validate_xml "$out"
}

test_build_inspect_roundtrip() {
  local out="$TMPDIR_TEST/roundtrip.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-008 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Roundtrip test|1|500|21" \
    --out "$out"
  # Text inspect should succeed
  $CLI ubl inspect --xml "$out"
  # JSON inspect should contain rootElement
  local inspect_json
  inspect_json=$($CLI --format json ubl inspect --xml "$out")
  echo "$inspect_json" | grep -q '"rootElement"'
}

test_zero_tax_line() {
  local out="$TMPDIR_TEST/zero-tax.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-009 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu scutit TVA|1|100|0" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_single_char_description() {
  local out="$TMPDIR_TEST/single-char.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-010 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "X|1|50|21" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_large_quantity() {
  local out="$TMPDIR_TEST/large-qty.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-011 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Produs bulk|99999|0.01|21" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_custom_unit_code() {
  local out="$TMPDIR_TEST/unit-code.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-012 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Ore consultanta|8|150|21|HUR" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_multiple_tax_rates() {
  local out="$TMPDIR_TEST/mixed-tax.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-013 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu standard|1|1000|21" \
    --line "Produse alimentare|10|50|9" \
    --line "Export scutit|1|2000|0" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_stdout_output() {
  # No --out flag: XML goes to stdout. Verify the UBL root element is present.
  local result
  result=$($CLI ubl build \
    --invoice-number TEST-UBL-014 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu stdout|1|100|21")
  echo "$result" | grep -q '<Invoice'
}

test_currency_eur() {
  # EUR invoice: CIUS-RO BR-53 requires a second TaxTotal with VAT in RON (BT-111).
  # 1 × 500 EUR @ 21% = 105 EUR VAT. At ~5.05 RON/EUR ≈ 530.25 RON VAT.
  local out="$TMPDIR_TEST/eur.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-015 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu EUR|1|500|21" \
    --currency EUR \
    --tax-currency-tax-amount 530.25 \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_partial_supplier_override() {
  # Only --supplier-name is overridden; address fields still come from ANAF lookup.
  local out="$TMPDIR_TEST/partial-supplier.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-016 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu partial override|1|200|21" \
    --supplier-name "Partial Override SRL" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_note_with_diacritics() {
  local out="$TMPDIR_TEST/diacritics.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-017 \
    --issue-date 2026-04-13 \
    --customer-cui "$CUSTOMER_CUI" \
    --line "Serviciu consultanță|1|300|21" \
    --note "Factură pentru servicii: consultanță și analiză tehnică" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

test_self_invoice() {
  # Customer CUI == supplier CUI: self-invoice (auto-facturare).
  local out="$TMPDIR_TEST/self-invoice.xml"
  $CLI ubl build \
    --invoice-number TEST-UBL-018 \
    --issue-date 2026-04-13 \
    --customer-cui "$ANAF_CUI" \
    --line "Serviciu auto-facturare|1|1000|21" \
    --out "$out"
  test -f "$out"
  validate_xml "$out"
}

# ── Run all tests ────────────────────────────────────────────────────

run_test "Basic single-line invoice"      test_basic_single_line
run_test "Multi-line invoice"             test_multi_line
run_test "All supplier/customer overrides" test_all_overrides
run_test "Optional fields (due, iban, note)" test_optional_fields
run_test "Build from YAML file"           test_from_yaml
run_test "Build from JSON file"           test_from_json
run_test "JSON output mode"               test_json_output
run_test "Build + Inspect round-trip"     test_build_inspect_roundtrip
run_test "Zero tax line (VAT exempt)"     test_zero_tax_line
run_test "Single character description"   test_single_char_description
run_test "Large quantity"                 test_large_quantity
run_test "Custom unit code (HUR)"         test_custom_unit_code
run_test "Multiple tax rates (21/9/0)"    test_multiple_tax_rates
run_test "Stdout output (no --out)"       test_stdout_output
run_test "EUR currency invoice"           test_currency_eur
run_test "Partial supplier override (name only)" test_partial_supplier_override
run_test "Note with Romanian diacritics"  test_note_with_diacritics
run_test "Self-invoice (supplier == customer)" test_self_invoice

# ── Upload tests (test mode only) ────────────────────────────────────
#
# Uploading to ANAF is only safe in test mode. We check the configured
# environment before running any upload, and skip gracefully if on prod.

echo ""
echo "==> Checking environment for upload tests"
CURRENT_ENV=$(
  $CLI --format json auth whoami 2>/dev/null \
  | grep -o '"env":"[^"]*"' | cut -d'"' -f4 2>/dev/null || true
)

if [ "$CURRENT_ENV" != "test" ]; then
  echo "    Environment is '${CURRENT_ENV:-unknown}', not 'test' — skipping upload tests."
else
  echo "    Environment: test. Running upload tests."

  test_upload_basic() {
    local out="$TMPDIR_TEST/upload-basic.xml"
    $CLI ubl build \
      --invoice-number TEST-UPL-001 \
      --issue-date 2026-04-13 \
      --customer-cui "$CUSTOMER_CUI" \
      --line "Serviciu upload|1|100|21" \
      --out "$out"

    # Upload and capture JSON response to extract the upload ID
    local result
    result=$($CLI --format json efactura upload --xml "$out")
    echo "$result" | grep -q '"indexIncarcare"'

    # Extract upload ID and check status
    local upload_id
    upload_id=$(echo "$result" | grep -o '"indexIncarcare":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$upload_id" ]; then
      echo "    Upload ID: $upload_id"
      # Status check — ANAF processing is async; 'in asteptare' (pending) is a valid response
      $CLI efactura status --upload-id "$upload_id"
    fi
  }

  test_upload_multiline() {
    local out="$TMPDIR_TEST/upload-multi.xml"
    $CLI ubl build \
      --invoice-number TEST-UPL-002 \
      --issue-date 2026-04-13 \
      --customer-cui "$CUSTOMER_CUI" \
      --line "Consultanta|5|200|21" \
      --line "Licenta software|1|1500|21" \
      --note "Upload integration test" \
      --out "$out"

    local result
    result=$($CLI --format json efactura upload --xml "$out")
    echo "$result" | grep -q '"indexIncarcare"'
    echo "    Upload ID: $(echo "$result" | grep -o '"indexIncarcare":"[^"]*"' | cut -d'"' -f4)"
  }

  run_test "Upload basic invoice"           test_upload_basic
  run_test "Upload multi-line invoice"      test_upload_multiline
fi

# ── Summary ──────────────────────────────────────────────────────────

echo ""
echo "============================================"
echo " UBL Test Summary"
echo "============================================"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Total:  $((PASSED + FAILED))"
echo "============================================"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
