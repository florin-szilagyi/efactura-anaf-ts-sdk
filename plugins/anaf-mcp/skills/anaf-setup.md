---
name: anaf-setup
description: First-time setup guide for the ANAF e-Factura MCP — walks through obtaining OAuth credentials, configuring env vars in Claude Code, and authenticating for a company. Use when the user wants to set up ANAF invoicing, says "set up ANAF", "configure ANAF", or gets auth errors from ANAF tools.
---

# ANAF MCP First-Time Setup

## Step 1 — Get ANAF OAuth credentials

You need an OAuth application registered in the ANAF portal. Follow the official registration guide:
**https://static.anaf.ro/static/10/Anaf/Informatii_R/API/Oauth_procedura_inregistrare_aplicatii_portal_ANAF.pdf**

You will receive:
- `ANAF_CLIENT_ID` — your OAuth app client ID
- `ANAF_CLIENT_SECRET` — your OAuth app secret
- Redirect URI — must be `https://localhost:9002/callback` (or another HTTPS localhost port you registered)

## Step 2 — Configure env vars in Claude Code

Open MCP settings with `/mcp`, or edit your `~/.claude.json` project config and set the env for the `anaf` server:

```json
{
  "ANAF_CLIENT_ID": "your-client-id",
  "ANAF_CLIENT_SECRET": "your-client-secret",
  "ANAF_REDIRECT_URI": "https://localhost:9002/callback",
  "ANAF_ENV": "prod"
}
```

**Test vs Production:** Set `ANAF_ENV` to `"test"` to use the ANAF sandbox — invoices are submitted to a test environment and not recorded for real. Always test there first before switching to `"prod"`.

After saving, restart the MCP server (type `/mcp` and reconnect).

## Step 3 — Authenticate for your company

Tell Claude:

> "Authenticate me for ANAF company CUI 12345678"

Claude will call `anaf_auth_login`, return a URL, ask you to open it in your browser, and then call `anaf_auth_complete` to finish. You sign in with your ANAF digital certificate in the browser.

Tokens are stored at `~/.local/share/anaf-cli/tokens/_default.json` (shared with `anaf-cli` if you use both).

## Step 4 — Verify it works

> "Look up company CUI 30498862"

Claude calls `anaf_lookup_company` (no auth needed) and returns company details. If that works, you're all set.

## Switching companies

> "Switch my active ANAF company to CUI 87654321"

Claude calls `anaf_switch_company`. No re-authentication needed — the token is shared across companies you've previously authenticated.

## Troubleshooting

| Error | Fix |
|---|---|
| `BAD_CONFIG: Missing ANAF_CLIENT_ID` | Set env vars and restart MCP |
| `NO_PENDING_AUTH` | Call `anaf_auth_login` first |
| `CLIENT_SECRET_MISSING` | Set `ANAF_CLIENT_SECRET` in env |
| `AUTH_FAILED` | Re-run `anaf_auth_login`, ensure `ANAF_REDIRECT_URI` matches your registered app |
