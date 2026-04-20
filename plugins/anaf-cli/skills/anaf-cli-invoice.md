---
name: anaf-cli-invoice
description: Create, validate, and submit Romanian e-invoices using the ANAF CLI. Use when the user wants to upload an invoice, use anaf-cli for invoicing, or run invoice commands. Requires anaf-cli to be set up (see anaf-cli-setup).
---

# ANAF CLI — Invoice Workflow

## Full workflow

```
Build UBL XML → Validate → Upload → Poll status → Download ZIP
```

## Build UBL invoice

```bash
anaf-cli ubl build \
  --seller-cui 12345678 \
  --buyer-cui 87654321 \
  --number "2024-001" \
  --date 2024-01-15 \
  --due-date 2024-02-15 \
  --line "Consultanta IT|1|1000|19" \
  --output invoice.xml
```

Line format: `"description|quantity|unit-price|vat-rate"`

## Validate

```bash
anaf-cli efactura validate --xml invoice.xml
```

Fix any reported errors before uploading. Always validate in **test** environment first.

## Upload

```bash
anaf-cli efactura upload --xml invoice.xml
```

Returns an upload index (e.g. `5003456789`). Save it.

## Check status

```bash
anaf-cli efactura status --index 5003456789
```

Retry every 30–60 seconds until status is `ok` or `nok`.

## Download signed ZIP

```bash
anaf-cli efactura download --index 5003456789 --output invoice-signed.zip
```

## Test vs Production

Use `anaf-cli ctx use my-company-test` to switch to the test environment before experimenting. Switch back with `anaf-cli ctx use my-company` for real submissions.

## YAML manifest mode (agentic/CI)

For automated pipelines, use a manifest file instead of individual commands:

```yaml
# job.yaml
apiVersion: anaf-cli/v1
kind: EFacturaUpload
spec:
  xml: invoice.xml
  standard: UBL
```

```bash
anaf-cli run -f job.yaml
```

Output is JSON — ideal for scripting or AI agent consumption.
