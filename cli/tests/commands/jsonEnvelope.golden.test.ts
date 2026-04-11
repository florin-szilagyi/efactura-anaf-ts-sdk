import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { runProgram } from '../../src/commands/runProgram';
import { ContextService, TokenStore } from '../../src/state';
import { AuthService, LookupService, EfacturaService, UblService } from '../../src/services';
import { getXdgPaths } from '../../src/state/paths';
import { EXIT_CODES } from '../../src/output/exitCodes';
import { AnafDetailsClient } from 'anaf-ts-sdk';

class Cap extends Writable {
  buf = '';
  _write(c: Buffer, _e: BufferEncoding, cb: (e?: Error | null) => void): void {
    this.buf += c.toString('utf8');
    cb();
  }
}

interface RunHarness {
  dir: string;
  contextService: ContextService;
  tokenStore: TokenStore;
  authService: AuthService;
  lookupService: LookupService;
  efacturaService: EfacturaService;
  ublService: UblService;
  run: (argv: readonly string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

function buildHarness(): RunHarness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anaf-cli-golden-'));
  const paths = getXdgPaths({
    configHome: path.join(dir, 'config'),
    dataHome: path.join(dir, 'data'),
    cacheHome: path.join(dir, 'cache'),
  });
  const contextService = new ContextService({ paths });
  const tokenStore = new TokenStore({ paths });
  const authService = new AuthService({
    contextService,
    tokenStore,
    authenticatorFactory: () => ({}) as never,
  });
  // Real AnafDetailsClient — used only for isValidVatCode (pure local), no network in golden tests.
  const lookupService = new LookupService({ client: new AnafDetailsClient(), paths });
  const efacturaService = new EfacturaService({ contextService, tokenStore, authService });
  const ublService = new UblService({ contextService, lookupService });

  return {
    dir,
    contextService,
    tokenStore,
    authService,
    lookupService,
    efacturaService,
    ublService,
    run: async (argv) => {
      const stdout = new Cap();
      const stderr = new Cap();
      let exitCode = 0;
      await runProgram({
        argv: ['node', 'anaf-cli', ...argv],
        streams: { stdout, stderr },
        exit: (code) => {
          exitCode = code;
        },
        services: {
          contextService,
          tokenStore,
          authService,
          lookupService,
          efacturaService,
          ublService,
        },
      });
      return { stdout: stdout.buf, stderr: stderr.buf, exitCode };
    },
  };
}

function expectSuccessEnvelope(raw: string): Record<string, unknown> {
  expect(raw.trim().length).toBeGreaterThan(0);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  expect(parsed).toHaveProperty('success', true);
  expect(parsed).toHaveProperty('data');
  return parsed.data as Record<string, unknown>;
}

function expectErrorEnvelope(raw: string): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  expect(raw.trim().length).toBeGreaterThan(0);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  expect(parsed).toHaveProperty('success', false);
  expect(parsed).toHaveProperty('error');
  const error = parsed.error as { code: string; message: string; details?: Record<string, unknown> };
  expect(typeof error.code).toBe('string');
  expect(typeof error.message).toBe('string');
  return error;
}

describe('JSON envelope golden consistency', () => {
  let h: RunHarness;
  beforeEach(() => {
    h = buildHarness();
  });
  afterEach(() => {
    fs.rmSync(h.dir, { recursive: true, force: true });
  });

  it('ctx ls success envelope (empty state)', async () => {
    const result = await h.run(['--json', 'ctx', 'ls']);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    const data = expectSuccessEnvelope(result.stdout);
    expect(data).toEqual({ current: undefined, contexts: [] });
  });

  it('ctx add success envelope carries the created context fields', async () => {
    const result = await h.run([
      '--json',
      'ctx',
      'add',
      '--name',
      'acme-prod',
      '--cui',
      'RO12345678',
      '--client-id',
      'cid',
      '--redirect-uri',
      'https://localhost/cb',
      '--env',
      'prod',
    ]);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    const data = expectSuccessEnvelope(result.stdout);
    expect(data).toEqual({
      name: 'acme-prod',
      environment: 'prod',
      companyCui: 'RO12345678',
    });
  });

  it('ctx ls after add shows one context and no current', async () => {
    h.contextService.add({
      name: 'acme-prod',
      companyCui: 'RO12345678',
      environment: 'prod',
      auth: { clientId: 'cid', redirectUri: 'https://localhost/cb' },
    });
    const result = await h.run(['--json', 'ctx', 'ls']);
    const data = expectSuccessEnvelope(result.stdout);
    const contexts = data.contexts as Array<Record<string, unknown>>;
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      name: 'acme-prod',
      environment: 'prod',
      companyCui: 'RO12345678',
      isCurrent: false,
    });
  });

  it('ctx current error envelope when no current context', async () => {
    const result = await h.run(['--json', 'ctx', 'current']);
    expect(result.exitCode).toBe(EXIT_CODES.LOCAL_STATE);
    expect(result.stdout).toBe('');
    const error = expectErrorEnvelope(result.stderr);
    expect(error.code).toBe('NO_CURRENT_CONTEXT');
  });

  it('auth whoami missing-token success envelope', async () => {
    h.contextService.add({
      name: 'acme-prod',
      companyCui: 'RO12345678',
      environment: 'prod',
      auth: { clientId: 'cid', redirectUri: 'https://localhost/cb' },
    });
    h.contextService.setCurrent('acme-prod');
    const result = await h.run(['--json', 'auth', 'whoami']);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    const data = expectSuccessEnvelope(result.stdout);
    expect(data).toMatchObject({
      context: 'acme-prod',
      tokenStatus: 'missing',
    });
  });

  it('lookup validate-cui success envelope carries cui + valid:true', async () => {
    const result = await h.run(['--json', 'lookup', 'validate-cui', 'RO12345678']);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    const data = expectSuccessEnvelope(result.stdout);
    expect(data).toEqual({ cui: 'RO12345678', valid: true });
  });

  it('lookup validate-cui error envelope for invalid cui uses USER_INPUT exit', async () => {
    const result = await h.run(['--json', 'lookup', 'validate-cui', 'not-a-cui']);
    expect(result.exitCode).toBe(EXIT_CODES.USER_INPUT);
    expect(result.stdout).toBe('');
    const error = expectErrorEnvelope(result.stderr);
    expect(error.code).toBe('INVALID_CUI');
  });

  it('unknown command produces a valid JSON envelope with BAD_USAGE (no commander noise)', async () => {
    const result = await h.run(['--json', 'definitely-not-a-command']);
    expect(result.exitCode).toBe(EXIT_CODES.USER_INPUT);
    // stderr must parse as a single JSON envelope (no leading "error:" line)
    const error = expectErrorEnvelope(result.stderr);
    expect(error.code).toBe('BAD_USAGE');
  });

  it('unknown global option produces a valid JSON envelope', async () => {
    const result = await h.run(['--json', '--definitely-not-a-flag']);
    expect(result.exitCode).toBe(EXIT_CODES.USER_INPUT);
    const error = expectErrorEnvelope(result.stderr);
    expect(error.code).toBe('BAD_USAGE');
  });

  it('every success envelope is { success: true, data: ... } exactly', async () => {
    h.contextService.add({
      name: 'acme-prod',
      companyCui: 'RO12345678',
      environment: 'prod',
      auth: { clientId: 'cid', redirectUri: 'https://localhost/cb' },
    });
    h.contextService.setCurrent('acme-prod');

    const commands: readonly (readonly string[])[] = [
      ['--json', 'ctx', 'ls'],
      ['--json', 'ctx', 'current'],
      ['--json', 'auth', 'whoami'],
      ['--json', 'lookup', 'validate-cui', 'RO12345678'],
    ];

    for (const argv of commands) {
      const result = await h.run(argv);
      expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      const keys = Object.keys(parsed).sort();
      expect(keys).toEqual(['data', 'success']);
      expect(parsed.success).toBe(true);
    }
  });

  it('every error envelope is { success: false, error: { code, message } } exactly', async () => {
    const commands: readonly (readonly string[])[] = [
      ['--json', 'ctx', 'current'], // NO_CURRENT_CONTEXT
      ['--json', 'ctx', 'use', 'nope'], // CONTEXT_NOT_FOUND
      ['--json', 'lookup', 'validate-cui', 'not-a-cui'], // INVALID_CUI
      ['--json', 'definitely-not-a-command'], // BAD_USAGE
    ];

    for (const argv of commands) {
      const result = await h.run(argv);
      const parsed = JSON.parse(result.stderr) as Record<string, unknown>;
      const keys = Object.keys(parsed).sort();
      expect(keys).toEqual(['error', 'success']);
      expect(parsed.success).toBe(false);
      const error = parsed.error as Record<string, unknown>;
      expect(typeof error.code).toBe('string');
      expect(typeof error.message).toBe('string');
      expect(result.stdout).toBe('');
    }
  });
});
