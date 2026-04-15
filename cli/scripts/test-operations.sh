#!/usr/bin/env bash
#
# test-operations.sh -- Run basic e-Factura operations against the ANAF test environment.
#
# Prerequisite: run test-setup.sh and test-auth.sh first.
#
# This script exercises:
#   1. Token check (whoami)
#   2. Company lookup
#   3. XML validation
#   4. Invoice upload + status check
#   5. Message listing
#
# All operations target the active company (set by test-auth.sh).
#
set -euo pipefail

CLI="${CLI:-node dist/bin/anaf-cli.cjs}"
ANAF_CUI="${ANAF_CUI:?Set ANAF_CUI}"

echo "============================================"
echo " ANAF CLI - Test Operations"
echo "============================================"
echo ""
$CLI cred set --env test
# ── 1. Token check ───────────────────────────────────────────────────
echo "==> 1. Checking authentication status"
$CLI auth whoami
echo ""

# ── 2. Company lookup ────────────────────────────────────────────────
echo "==> 2. Looking up company CUI: $ANAF_CUI"
$CLI lookup company "$ANAF_CUI" || echo "    (lookup may not be available in test)"
echo ""

# ── 3. Create a sample invoice XML ──────────────────────────────────
SAMPLE_XML=$(mktemp /tmp/test-invoice-XXXXXX.xml)
cat > "$SAMPLE_XML" << 'XMLEOF'
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>TEST-2026-001</cbc:ID>
  <cbc:IssueDate>2026-04-12</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Test Supplier SRL</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Str Test 1</cbc:StreetName>
        <cbc:CityName>Bucuresti</cbc:CityName>
        <cbc:PostalZone>010101</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>RO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RO12345678</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Test Supplier SRL</cbc:RegistrationName>
        <cbc:CompanyID>RO12345678</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Test Customer SRL</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Str Client 2</cbc:StreetName>
        <cbc:CityName>Cluj-Napoca</cbc:CityName>
        <cbc:PostalZone>400001</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>RO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RO87654321</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Test Customer SRL</cbc:RegistrationName>
        <cbc:CompanyID>RO87654321</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">21.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="RON">100.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="RON">21.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>21</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="RON">100.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="RON">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">121.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">121.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="RON">100.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Test service</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>21</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="RON">100.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>
XMLEOF

echo "==> 3. Validating sample invoice XML"
$CLI efactura validate --xml "$SAMPLE_XML" && echo "    VALID" || echo "    Validation returned errors (expected for test XML)"
echo ""

# ── 4. Upload ────────────────────────────────────────────────────────
echo "==> 4. Uploading invoice to ANAF test environment"
UPLOAD_RESULT=$($CLI efactura upload --xml "$SAMPLE_XML" --json 2>/dev/null) || true
echo "    Upload result: $UPLOAD_RESULT"

# Try to extract upload ID and check status
UPLOAD_ID=$(echo "$UPLOAD_RESULT" | grep -o '"indexIncarcare":"[^"]*"' | cut -d'"' -f4 2>/dev/null || true)
if [ -n "$UPLOAD_ID" ]; then
  echo ""
  echo "==> 4b. Checking upload status (ID: $UPLOAD_ID)"
  sleep 2
  $CLI efactura status --upload-id "$UPLOAD_ID" || echo "    Status check returned an error"
fi
echo ""

# ── 5. List messages ─────────────────────────────────────────────────
echo "==> 5. Listing recent messages (last 7 days)"
$CLI efactura messages --days 7 || echo "    No messages or error"
echo ""

# ── Cleanup ──────────────────────────────────────────────────────────
rm -f "$SAMPLE_XML"

echo "============================================"
echo " All operations completed."
echo "============================================"
