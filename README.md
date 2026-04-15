# ts-anaf

TypeScript SDK and CLI for Romania's [ANAF e-Factura](https://www.anaf.ro/anaf/internet/ANAF/despre_ANAF/informatii_publice/media/e_factura) system.

Upload invoices, check statuses, download responses, validate XML, generate UBL, and look up company data -- from code or the command line.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [**@florinszilagyi/anaf-ts-sdk**](./sdk/) | TypeScript SDK -- OAuth, upload, status, download, UBL builder, company lookup | `pnpm add @florinszilagyi/anaf-ts-sdk` |
| [**@florinszilagyi/anaf-cli**](./cli/) | Command-line tool -- wraps the SDK with context management and JSON output | `npm i -g @florinszilagyi/anaf-cli` |

## CLI quick start

```bash
# Install
npm i -g @florinszilagyi/anaf-cli

# Save your ANAF OAuth app credentials
anaf-cli cred add --name my-app \
  --client-id $ANAF_CLIENT_ID \
  --client-secret $ANAF_CLIENT_SECRET \
  --redirect-uri https://localhost:9002/callback

# Add a company
anaf-cli ctx add --name my-company --cui 12345678 --credential my-app
anaf-cli ctx use my-company

# Authenticate (opens browser automatically)
anaf-cli auth login

# Upload an invoice
anaf-cli efactura upload --xml invoice.xml
```

See [cli/README.md](./cli/) for the full command reference.

## SDK quick start

```typescript
import { AnafAuthenticator, EfacturaClient, TokenManager } from '@florinszilagyi/anaf-ts-sdk';

// Authenticate
const auth = new AnafAuthenticator({
  clientId: process.env.ANAF_CLIENT_ID!,
  clientSecret: process.env.ANAF_CLIENT_SECRET!,
  redirectUri: 'https://localhost:9002/callback',
});
const tokens = await auth.exchangeCodeForToken(code);
const tokenManager = new TokenManager(auth, tokens.refresh_token);

// Upload
const client = new EfacturaClient({ vatNumber: 'RO12345678', testMode: true }, tokenManager);
const result = await client.uploadDocument(xml, { standard: 'UBL' });
const status = await client.getUploadStatus(result.index_incarcare);
```

See [sdk/README.md](./sdk/) for the full API reference.

## Development

```bash
git clone https://github.com/florin-szilagyi/ts-anaf.git
cd ts-anaf
pnpm install

pnpm build          # build both SDK and CLI
pnpm test           # test both
pnpm verify         # lint + build + test
```

## License

MIT
