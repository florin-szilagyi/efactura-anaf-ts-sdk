import { Writable } from 'node:stream';
import { buildProgram } from '../../../src/commands/buildProgram';
import { LookupService } from '../../../src/services';
import { CliError } from '../../../src/output/errors';
import { makeOutputContext } from '../../../src/output';
import { lookupCompany, lookupCompanyAsync, lookupValidateCui } from '../../../src/commands/groups/lookup';
import type { AnafCompanyData } from 'anaf-ts-sdk';

describe('lookup group', () => {
  it('registers company, company-async, validate-cui', () => {
    const program = buildProgram({
      output: makeOutputContext({ format: 'text' }),
      services: {} as never,
    });
    const l = program.commands.find((c) => c.name() === 'lookup')!;
    expect(l.commands.map((c) => c.name()).sort()).toEqual(['company', 'company-async', 'validate-cui']);
  });
});

class Cap extends Writable {
  buf = '';
  _write(c: Buffer, _e: BufferEncoding, cb: (e?: Error | null) => void): void {
    this.buf += c.toString('utf8');
    cb();
  }
}

const fakeCompany = (cui: string, name = 'Acme SRL'): AnafCompanyData => ({
  vatCode: cui,
  name,
  registrationNumber: 'J40/1/2020',
  address: 'Bucuresti, Sector 1',
  postalCode: '012345',
  contactPhone: '021-1',
  scpTva: true,
});

class StubLookupService {
  batchResult: AnafCompanyData[] | Error = [];
  asyncResult: AnafCompanyData | Error = fakeCompany('12345678');
  validResult = true;
  async batchGetCompanies(_cuis: readonly string[]): Promise<AnafCompanyData[]> {
    if (this.batchResult instanceof Error) throw this.batchResult;
    return this.batchResult;
  }
  async getCompanyAsync(_cui: string): Promise<AnafCompanyData> {
    if (this.asyncResult instanceof Error) throw this.asyncResult;
    return this.asyncResult;
  }
  async validateCui(_cui: string): Promise<boolean> {
    return this.validResult;
  }
}

function harness() {
  const stdout = new Cap();
  const stderr = new Cap();
  const lookupService = new StubLookupService();
  const text = makeOutputContext({ format: 'text', streams: { stdout, stderr } });
  const json = makeOutputContext({ format: 'json', streams: { stdout, stderr } });
  const services = { lookupService: lookupService as unknown as LookupService } as never;
  return { stdout, stderr, lookupService, text, json, services };
}

describe('lookupCompany', () => {
  it('text mode prints one line per company', async () => {
    const h = harness();
    h.lookupService.batchResult = [fakeCompany('12345678', 'Acme'), fakeCompany('87654321', 'Beta')];
    await lookupCompany({ output: h.text, services: h.services }, ['RO12345678', 'RO87654321'], {});
    const lines = h.stdout.buf.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('12345678');
    expect(lines[0]).toContain('Acme');
  });

  it('json mode emits a companies envelope', async () => {
    const h = harness();
    h.lookupService.batchResult = [fakeCompany('12345678')];
    await lookupCompany({ output: h.json, services: h.services }, ['RO12345678'], {});
    const parsed = JSON.parse(h.stdout.buf);
    expect(parsed.success).toBe(true);
    expect(parsed.data.companies).toHaveLength(1);
    expect(parsed.data.companies[0].vatCode).toBe('12345678');
  });

  it('propagates LOOKUP_FAILED CliError from the service', async () => {
    const h = harness();
    h.lookupService.batchResult = new CliError({
      code: 'LOOKUP_FAILED',
      message: 'network down',
      category: 'anaf_api',
    });
    await expect(lookupCompany({ output: h.text, services: h.services }, ['RO12345678'], {})).rejects.toBeInstanceOf(
      CliError
    );
  });
});

describe('lookupCompanyAsync', () => {
  it('returns a single company envelope', async () => {
    const h = harness();
    h.lookupService.asyncResult = fakeCompany('12345678', 'Async Co');
    await lookupCompanyAsync({ output: h.json, services: h.services }, 'RO12345678', {});
    const parsed = JSON.parse(h.stdout.buf);
    expect(parsed.data.name).toBe('Async Co');
  });
});

describe('lookupValidateCui', () => {
  it('text mode prints "valid" and exits success when valid', async () => {
    const h = harness();
    h.lookupService.validResult = true;
    await lookupValidateCui({ output: h.text, services: h.services }, 'RO12345678');
    expect(h.stdout.buf.trim()).toBe('valid');
  });

  it('throws CliError(user_input, INVALID_CUI) when invalid', async () => {
    const h = harness();
    h.lookupService.validResult = false;
    let err: unknown;
    try {
      await lookupValidateCui({ output: h.text, services: h.services }, 'not-a-cui');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).category).toBe('user_input');
    expect((err as CliError).code).toBe('INVALID_CUI');
  });

  it('json mode emits {cui, valid: true} on valid input', async () => {
    const h = harness();
    h.lookupService.validResult = true;
    await lookupValidateCui({ output: h.json, services: h.services }, 'RO12345678');
    const parsed = JSON.parse(h.stdout.buf);
    expect(parsed.data).toEqual({ cui: 'RO12345678', valid: true });
  });
});
