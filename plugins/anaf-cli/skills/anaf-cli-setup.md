---
name: anaf-cli-setup
description: First-time setup guide for the ANAF e-Factura CLI — install, configure OAuth credentials, add a company context, and authenticate. Use when the user wants to set up anaf-cli, says "install ANAF CLI", "configure ANAF", or gets auth/config errors.
---

# ANAF CLI First-Time Setup

## Step 1 — Get ANAF OAuth credentials

You need an OAuth application registered in the ANAF portal. Follow the official registration guide:
**https://static.anaf.ro/static/10/Anaf/Informatii_R/API/Oauth_procedura_inregistrare_aplicatii_portal_ANAF.pdf**

You will receive:
- `ANAF_CLIENT_ID` — your OAuth app client ID
- `ANAF_CLIENT_SECRET` — your OAuth app secret
- Redirect URI — must be `https://localhost:9002/callback` (or another HTTPS localhost port you registered)

## Step 2 — Install the CLI

```bash
npm i -g @florinszilagyi/anaf-cli
anaf-cli --version
```

## Step 3 — Save your OAuth credential

```bash
anaf-cli cred add --name my-app \
  --client-id $ANAF_CLIENT_ID \
  --client-secret $ANAF_CLIENT_SECRET \
  --redirect-uri https://localhost:9002/callback
```

## Step 4 — Add a company context

```bash
anaf-cli ctx add --name my-company --cui 12345678 --credential my-app
anaf-cli ctx use my-company
```

## Step 5 — Authenticate

```bash
anaf-cli auth login
```

This opens a browser where you sign in with your ANAF digital certificate. After completing, the refresh token is stored at `~/.local/share/anaf-cli/tokens/_default.json`.

## Test vs Production

By default the CLI uses the **production** ANAF environment. To use the **test** environment (sandbox — no real invoices submitted):

```bash
anaf-cli ctx add --name my-company-test --cui 12345678 --credential my-app --env test
anaf-cli ctx use my-company-test
```

Always validate in test first before switching to prod.

## Verify it works

```bash
anaf-cli lookup 30498862
```

Returns ANAF company data. If that works, you're ready.
