# FGO Invoices MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first FGO integration focused on invoice workflows: credential-based auth, create invoice, fetch invoice artifacts/status for a known invoice, and document the hard boundary around unsupported public operations.

**Architecture:** Keep FGO isolated from the ANAF OAuth clients. Add a small FGO module that signs every request with the documented uppercase SHA-1 hash scheme, reuses the existing `HttpClient`, and exposes one focused client for invoice operations. Do not model this as interactive "login": FGO public API auth is request signing with `CodUnic` + `PrivateKey`, not a browser/session flow.

**Tech Stack:** TypeScript, native `fetch` via existing `HttpClient`, Node `crypto`, Jest, existing package export surface.

---

## Scope Lock

As of **March 25, 2026**, the public FGO API docs expose these invoice endpoints: `factura/emitere`, `factura/print`, `factura/stergere`, `factura/anulare`, `factura/getstatus`, `factura/incasare`, `factura/stornare`, `factura/awb`, `factura/listfacturiasociate`.

The same public docs do **not** expose:

- an interactive account login/session endpoint
- a general "list invoices" endpoint
- a "send invoice by email" endpoint
- a "send invoice to SPV/eFactura" endpoint

The public FGO help center confirms that e-Factura sending exists in the **FGO UI/account workflow**, but I did not find a public API endpoint for that workflow in the public API docs.

**MVP consequence:** ship the documented invoice API first. Treat invoice listing, email sending, and e-Factura submission as a gated follow-up that requires written confirmation from FGO support or additional official docs.

**Primary references:**

- `https://api.fgo.ro/v1/files/specificatii-api-latest.pdf`
- `https://api.fgo.ro/v1/testing.html`
- `https://www.fgo.ro/ajutor/manual-utilizare-fgo?capitol=E-factura&ordine=03+02%2F&subcapitol=Transmiterea+unei+facturi+in+sistemul+E-factura+%28ANAF%29+dintr-un+cont+FGO+platit`

### Task 1: Lock FGO surface and capability notes

**Files:**
- Create: `docs/fgo-api-capabilities.md`
- Modify: `README.md`

- [ ] **Step 1: Write the capability note before code**

Create `docs/fgo-api-capabilities.md` with a table that distinguishes documented vs. undocumented operations:

```md
# FGO API Capability Notes

## Documented public operations

- Auth via `CodUnic` + `PrivateKey` + uppercase SHA-1 hash
- `factura/emitere`
- `factura/print`
- `factura/getstatus`
- `factura/anulare`
- `factura/stergere`

## Not documented in the public API

- interactive login
- invoice list/search
- send invoice by email
- send invoice to SPV/eFactura

## Product decision

The SDK ships only documented public API methods in v1 of the FGO module.
```

- [ ] **Step 2: Add README scope language**

Add a short `FGO (planned)` section to `README.md`:

```md
## FGO (planned)

The first FGO integration will cover documented invoice endpoints only:

- request-signing auth
- create invoice
- print invoice PDF link
- invoice status
- cancel/delete invoice

Invoice listing, email sending, and SPV/eFactura sending are intentionally excluded from the first implementation until FGO documents public API endpoints for them.
```

- [ ] **Step 3: Review the note against the official docs**

Manual check:

```text
Confirm that every endpoint listed in docs/fgo-api-capabilities.md exists in
https://api.fgo.ro/v1/files/specificatii-api-latest.pdf
and that no public endpoint for invoice list, email send, or eFactura send was added after 2026-03-25.
```

- [ ] **Step 4: Commit**

```bash
git add docs/fgo-api-capabilities.md README.md
git commit -m "docs: lock initial FGO invoice scope"
```

### Task 2: Add hash-auth primitives and FGO config types

**Files:**
- Create: `src/fgo/types.ts`
- Create: `src/fgo/hash.ts`
- Create: `src/fgo/constants.ts`
- Test: `tests/fgoHash.unit.test.ts`

- [ ] **Step 1: Write the failing hash tests**

```ts
import { createInvoiceHash, createInvoiceActionHash, createSimpleAuthHash } from '../src/fgo/hash';

describe('FGO hash helpers', () => {
  it('creates emitere hash from CUI + private key + client name', () => {
    expect(createInvoiceHash('2864518', '1234567890', 'Ionescu Popescu')).toBe(
      '8C3A7726804C121C6933F7D68494B439463996E2'
    );
  });

  it('creates action hash from CUI + private key + invoice number', () => {
    expect(createInvoiceActionHash('2864518', '1234567890', '123')).toBe(
      '6D7E20FCBA3960857BFF910DDA2E731485CC2BE5'
    );
  });

  it('creates simple auth hash from CUI + private key', () => {
    expect(createSimpleAuthHash('2864518', '1234567890')).toHaveLength(40);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec jest tests/fgoHash.unit.test.ts --runInBand`

Expected: FAIL because `src/fgo/hash.ts` does not exist.

- [ ] **Step 3: Write minimal FGO types and constants**

```ts
export interface FgoConfig {
  codUnic: string;
  privateKey: string;
  platformUrl: string;
  testMode?: boolean;
  timeout?: number;
}

export const FGO_TEST_BASE_URL = 'https://api-testuat.fgo.ro/v1';
export const FGO_PROD_BASE_URL = 'https://api.fgo.ro/v1';
export const FGO_DEFAULT_TIMEOUT = 30000;
```

- [ ] **Step 4: Implement hash helpers**

```ts
import { createHash } from 'crypto';

function sha1Upper(value: string): string {
  return createHash('sha1').update(value).digest('hex').toUpperCase();
}

export function createInvoiceHash(codUnic: string, privateKey: string, clientName: string): string {
  return sha1Upper(`${codUnic}${privateKey}${clientName}`);
}

export function createInvoiceActionHash(codUnic: string, privateKey: string, invoiceNumber: string): string {
  return sha1Upper(`${codUnic}${privateKey}${invoiceNumber}`);
}

export function createSimpleAuthHash(codUnic: string, privateKey: string): string {
  return sha1Upper(`${codUnic}${privateKey}`);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec jest tests/fgoHash.unit.test.ts --runInBand`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/fgo/types.ts src/fgo/hash.ts src/fgo/constants.ts tests/fgoHash.unit.test.ts
git commit -m "feat: add FGO auth primitives"
```

### Task 3: Add a small FGO request layer

**Files:**
- Create: `src/FgoClient.ts`
- Modify: `src/utils/httpClient.ts`
- Test: `tests/fgoClient.unit.test.ts`

- [ ] **Step 1: Write the failing request-shape tests**

```ts
import { FgoClient } from '../src/FgoClient';

describe('FgoClient', () => {
  it('uses the UAT base url when testMode is true', () => {
    const client = new FgoClient({
      codUnic: '2864518',
      privateKey: 'secret',
      platformUrl: 'https://example.com',
      testMode: true,
    });

    expect(client.getBaseUrl()).toBe('https://api-testuat.fgo.ro/v1');
  });

  it('injects CodUnic and PlatformaUrl into request payloads', () => {
    const payload = new FgoClient({
      codUnic: '2864518',
      privateKey: 'secret',
      platformUrl: 'https://example.com',
    }).buildPayload({ Serie: 'BV' });

    expect(payload).toMatchObject({
      CodUnic: '2864518',
      PlatformaUrl: 'https://example.com',
      Serie: 'BV',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec jest tests/fgoClient.unit.test.ts --runInBand`

Expected: FAIL because `FgoClient` does not exist.

- [ ] **Step 3: Implement the focused base client**

```ts
import { HttpClient } from './utils/httpClient';
import { FgoConfig } from './fgo/types';
import { FGO_DEFAULT_TIMEOUT, FGO_PROD_BASE_URL, FGO_TEST_BASE_URL } from './fgo/constants';

export class FgoClient {
  protected readonly config: Required<FgoConfig>;
  protected readonly httpClient: HttpClient;

  constructor(config: FgoConfig, httpClient?: HttpClient) {
    this.config = {
      ...config,
      testMode: config.testMode ?? false,
      timeout: config.timeout ?? FGO_DEFAULT_TIMEOUT,
    };

    this.httpClient =
      httpClient ??
      new HttpClient({
        baseURL: this.getBaseUrl(),
        timeout: this.config.timeout,
      });
  }

  getBaseUrl(): string {
    return this.config.testMode ? FGO_TEST_BASE_URL : FGO_PROD_BASE_URL;
  }

  buildPayload<T extends Record<string, unknown>>(payload: T): T & { CodUnic: string; PlatformaUrl: string } {
    return {
      CodUnic: this.config.codUnic,
      PlatformaUrl: this.config.platformUrl,
      ...payload,
    };
  }
}
```

- [ ] **Step 4: Harden `HttpClient` for FGO JSON error bodies**

Add an assertion to preserve raw text on non-JSON error responses and return JSON bodies unchanged:

```ts
if (contentType.includes('application/json')) {
  return response.json() as Promise<T>;
}

return response.text() as Promise<T>;
```

If this already matches the current implementation, keep the file unchanged and note that `HttpClient` is already sufficient for FGO.

- [ ] **Step 5: Run the tests**

Run: `pnpm exec jest tests/fgoClient.unit.test.ts --runInBand`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/FgoClient.ts src/utils/httpClient.ts tests/fgoClient.unit.test.ts
git commit -m "feat: add FGO base client"
```

### Task 4: Implement documented invoice operations only

**Files:**
- Create: `src/FgoInvoicesClient.ts`
- Modify: `src/fgo/types.ts`
- Test: `tests/fgoInvoicesClient.unit.test.ts`

- [ ] **Step 1: Write the failing invoice client tests**

```ts
import { FgoInvoicesClient } from '../src/FgoInvoicesClient';

describe('FgoInvoicesClient', () => {
  it('builds emitere payloads with the emitere hash', async () => {
    const client = new FgoInvoicesClient({
      codUnic: '2864518',
      privateKey: '1234567890',
      platformUrl: 'https://example.com',
    });

    const payload = client.buildEmitInvoicePayload({
      serie: 'BV',
      valuta: 'RON',
      tipFactura: 'Factura',
      client: {
        denumire: 'Ionescu Popescu',
        tara: 'RO',
        judet: 'Bucuresti',
        tip: 'PF',
      },
      continut: [
        {
          denumire: 'Servicii Consultanta',
          nrProduse: 2,
          um: 'ORE',
          cotaTva: 21,
          pretUnitar: 100,
        },
      ],
    });

    expect(payload.Hash).toBe('8C3A7726804C121C6933F7D68494B439463996E2');
  });

  it('builds print payloads with the action hash', () => {
    const client = new FgoInvoicesClient({
      codUnic: '2864518',
      privateKey: '1234567890',
      platformUrl: 'https://example.com',
    });

    const payload = client.buildInvoiceActionPayload({ numar: '123', serie: 'BV' });
    expect(payload).toMatchObject({ Numar: '123', Serie: 'BV' });
    expect(payload.Hash).toHaveLength(40);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec jest tests/fgoInvoicesClient.unit.test.ts --runInBand`

Expected: FAIL because `FgoInvoicesClient` does not exist.

- [ ] **Step 3: Add the invoice types**

```ts
export interface FgoInvoicePartyInput {
  denumire: string;
  codUnic?: string;
  email?: string;
  telefon?: string;
  tara: string;
  judet?: string;
  localitate?: string;
  adresa?: string;
  tip: 'PF' | 'PJ';
}

export interface FgoInvoiceLineInput {
  denumire: string;
  nrProduse: number;
  um: string;
  cotaTva: number;
  pretUnitar?: number;
  pretTotal?: number;
}

export interface EmitFgoInvoiceInput {
  serie: string;
  numar?: string;
  valuta: string;
  tipFactura: string;
  dataEmitere?: string;
  dataScadenta?: string;
  client: FgoInvoicePartyInput;
  continut: FgoInvoiceLineInput[];
}
```

- [ ] **Step 4: Implement documented invoice methods**

```ts
export class FgoInvoicesClient extends FgoClient {
  buildEmitInvoicePayload(input: EmitFgoInvoiceInput) {
    return this.buildPayload({
      Hash: createInvoiceHash(this.config.codUnic, this.config.privateKey, input.client.denumire),
      Serie: input.serie,
      Numar: input.numar,
      Valuta: input.valuta,
      TipFactura: input.tipFactura,
      DataEmitere: input.dataEmitere,
      DataScadenta: input.dataScadenta,
      Client: {
        Denumire: input.client.denumire,
        CodUnic: input.client.codUnic,
        Email: input.client.email,
        Telefon: input.client.telefon,
        Tara: input.client.tara,
        Judet: input.client.judet,
        Localitate: input.client.localitate,
        Adresa: input.client.adresa,
        Tip: input.client.tip,
      },
      Continut: input.continut.map((line) => ({
        Denumire: line.denumire,
        NrProduse: line.nrProduse,
        UM: line.um,
        CotaTVA: line.cotaTva,
        PretUnitar: line.pretUnitar,
        PretTotal: line.pretTotal,
      })),
    });
  }

  buildInvoiceActionPayload(input: { numar: string; serie: string }) {
    return this.buildPayload({
      Hash: createInvoiceActionHash(this.config.codUnic, this.config.privateKey, input.numar),
      Numar: input.numar,
      Serie: input.serie,
    });
  }

  emitInvoice(input: EmitFgoInvoiceInput) {
    return this.httpClient.post('/factura/emitere', this.buildEmitInvoicePayload(input));
  }

  printInvoice(numar: string, serie: string) {
    return this.httpClient.post('/factura/print', this.buildInvoiceActionPayload({ numar, serie }));
  }

  getInvoiceStatus(numar: string, serie: string) {
    return this.httpClient.post('/factura/getstatus', this.buildInvoiceActionPayload({ numar, serie }));
  }

  cancelInvoice(numar: string, serie: string) {
    return this.httpClient.post('/factura/anulare', this.buildInvoiceActionPayload({ numar, serie }));
  }

  deleteInvoice(numar: string, serie: string) {
    return this.httpClient.post('/factura/stergere', this.buildInvoiceActionPayload({ numar, serie }));
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec jest tests/fgoInvoicesClient.unit.test.ts --runInBand`

Expected: PASS

- [ ] **Step 6: Add request-level coverage**

Extend `tests/fgoInvoicesClient.unit.test.ts` with one mocked request per endpoint:

```ts
it('posts to /factura/getstatus', async () => {
  const post = jest.fn().mockResolvedValue({ data: { Success: true } });
  const client = new FgoInvoicesClient(config, { post } as any);

  await client.getInvoiceStatus('123', 'BV');

  expect(post).toHaveBeenCalledWith(
    '/factura/getstatus',
    expect.objectContaining({ Numar: '123', Serie: 'BV' })
  );
});
```

- [ ] **Step 7: Commit**

```bash
git add src/FgoInvoicesClient.ts src/fgo/types.ts tests/fgoInvoicesClient.unit.test.ts
git commit -m "feat: add documented FGO invoice operations"
```

### Task 5: Export the FGO module and document usage

**Files:**
- Modify: `src/index.ts`
- Modify: `README.md`
- Test: `tests/fgoExports.unit.test.ts`

- [ ] **Step 1: Write the failing export test**

```ts
import * as sdk from '../src/index';

describe('FGO exports', () => {
  it('exports FgoInvoicesClient', () => {
    expect(sdk.FgoInvoicesClient).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec jest tests/fgoExports.unit.test.ts --runInBand`

Expected: FAIL because `FgoInvoicesClient` is not exported.

- [ ] **Step 3: Export the FGO surface**

Update `src/index.ts`:

```ts
export { FgoClient } from './FgoClient';
export { FgoInvoicesClient } from './FgoInvoicesClient';
export * as FgoTypes from './fgo/types';
```

- [ ] **Step 4: Add README examples that match the documented public API**

```ts
import { FgoInvoicesClient } from 'anaf-ts-sdk';

const client = new FgoInvoicesClient({
  codUnic: '2864518',
  privateKey: process.env.FGO_PRIVATE_KEY!,
  platformUrl: 'https://yourapp.com',
  testMode: true,
});

const result = await client.emitInvoice({
  serie: 'BV',
  valuta: 'RON',
  tipFactura: 'Factura',
  client: {
    denumire: 'Ionescu Popescu',
    tara: 'RO',
    judet: 'Bucuresti',
    tip: 'PF',
  },
  continut: [
    {
      denumire: 'Servicii Consultanta',
      nrProduse: 2,
      um: 'ORE',
      cotaTva: 21,
      pretUnitar: 100,
    },
  ],
});
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
pnpm exec jest tests/fgoHash.unit.test.ts tests/fgoClient.unit.test.ts tests/fgoInvoicesClient.unit.test.ts tests/fgoExports.unit.test.ts --runInBand
```

Expected: PASS

- [ ] **Step 6: Run the package build**

Run: `pnpm run build`

Expected: build completes successfully and emits `dist/` artifacts with the new FGO exports.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts README.md tests/fgoExports.unit.test.ts
git commit -m "feat: export FGO invoice client"
```

### Task 6: Gate the non-documented goals into Phase 2 instead of guessing

**Files:**
- Modify: `docs/fgo-api-capabilities.md`
- Modify: `docs/superpowers/plans/2026-04-11-fgo-invoices-mvp.md`

- [ ] **Step 1: Send the exact support question to FGO**

Use this message:

```text
We are integrating the public FGO API into a TypeScript SDK. In the latest public API docs we found endpoints for emitere, print, anulare, stergere, getstatus, incasare, stornare, awb, and listfacturiasociate.

Please confirm whether there are official public API endpoints for:
1. listing invoices from an account
2. sending an invoice by email
3. sending an issued invoice to SPV/eFactura

If they exist, please send the endpoint paths, request schema, hash formula, plan restrictions, and latest documentation URL.
```

- [ ] **Step 2: Apply the decision rule**

```text
If FGO confirms there are no public endpoints, close Phase 1 after Task 5 and create a separate Phase 2 plan for either:
- UI/browser automation outside the SDK, or
- a private integration provided directly by FGO.

If FGO provides official docs, write a follow-up implementation plan limited to those documented methods.
```

- [ ] **Step 3: Update the capability note with the support answer**

Append one of these exact outcomes to `docs/fgo-api-capabilities.md`:

```md
## Support confirmation

- Date: 2026-04-11
- Outcome: FGO public API does not expose invoice list/email/eFactura endpoints.
- Product decision: keep these workflows out of the SDK until official docs exist.
```

or

```md
## Support confirmation

- Date: 2026-04-11
- Outcome: FGO provided official docs for invoice list/email/eFactura.
- Next step: create `docs/superpowers/plans/2026-04-11-fgo-delivery-phase2.md`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/fgo-api-capabilities.md docs/superpowers/plans/2026-04-11-fgo-invoices-mvp.md
git commit -m "docs: gate undocumented FGO delivery workflows"
```

## Acceptance Criteria

- `FgoInvoicesClient` exists and supports only documented public invoice endpoints.
- Request signing is deterministic and covered by tests.
- README explicitly states that FGO auth is hash-based, not an interactive login flow.
- The repo contains a written capability note that blocks invoice list, email delivery, and SPV/eFactura sending until FGO publishes or confirms official endpoints.
- The package builds cleanly and exports the new FGO client.

## Out Of Scope For This Plan

- article/catalog endpoints
- stock/warehouse endpoints
- payments/incasari
- storno/AWB/listfacturiasociate implementation
- browser automation against the FGO web app
- reverse-engineering private FGO endpoints
