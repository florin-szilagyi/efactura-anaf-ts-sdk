import { Writable } from 'node:stream';
import { runProgram } from '../../src/commands/runProgram';
import { EXIT_CODES } from '../../src/output/exitCodes';

class Cap extends Writable {
  buf = '';
  _write(c: Buffer, _e: BufferEncoding, cb: (e?: Error | null) => void): void {
    this.buf += c.toString('utf8');
    cb();
  }
}

function harness() {
  const stdout = new Cap();
  const stderr = new Cap();
  let exitCode: number | undefined;
  const exit = (code: number): void => {
    exitCode = code;
  };
  return {
    streams: { stdout, stderr },
    exit,
    stdout,
    stderr,
    code: () => exitCode,
  };
}

describe('runProgram', () => {
  it('exits 1 with NOT_IMPLEMENTED for a stub leaf in text mode', async () => {
    const h = harness();
    await runProgram({
      argv: ['node', 'anaf-cli', 'auth', 'login'],
      streams: h.streams,
      exit: h.exit,
    });
    expect(h.code()).toBe(EXIT_CODES.GENERIC_FAILURE);
    expect(h.stderr.buf).toContain('NOT_IMPLEMENTED');
    expect(h.stderr.buf).toContain('auth login');
    expect(h.stdout.buf).toBe('');
  });

  it('emits a JSON error envelope when --json is set', async () => {
    const h = harness();
    await runProgram({
      argv: ['node', 'anaf-cli', '--json', 'auth', 'login'],
      streams: h.streams,
      exit: h.exit,
    });
    expect(h.code()).toBe(EXIT_CODES.GENERIC_FAILURE);
    const parsed = JSON.parse(h.stderr.buf);
    expect(parsed).toMatchObject({
      success: false,
      error: { code: 'NOT_IMPLEMENTED' },
    });
  });

  it('--version exits 0 and writes the version to stdout', async () => {
    const h = harness();
    await runProgram({ argv: ['node', 'anaf-cli', '--version'], streams: h.streams, exit: h.exit });
    expect(h.code()).toBe(EXIT_CODES.SUCCESS);
    expect(h.stdout.buf.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('--help exits 0 and writes usage to stdout', async () => {
    const h = harness();
    await runProgram({ argv: ['node', 'anaf-cli', '--help'], streams: h.streams, exit: h.exit });
    expect(h.code()).toBe(EXIT_CODES.SUCCESS);
    expect(h.stdout.buf).toContain('Usage: anaf-cli');
  });

  it('unknown command exits 2 (USER_INPUT) with code BAD_USAGE', async () => {
    const h = harness();
    await runProgram({
      argv: ['node', 'anaf-cli', 'definitely-not-a-command'],
      streams: h.streams,
      exit: h.exit,
    });
    expect(h.code()).toBe(EXIT_CODES.USER_INPUT);
    expect(h.stderr.buf).toContain('BAD_USAGE');
  });

  it('normalizes a non-Error throw thrown by an action handler', async () => {
    const { normalizeThrown } = await import('../../src/commands/runProgram');
    expect(normalizeThrown('boom')).toBeInstanceOf(Error);
    expect(normalizeThrown('boom').message).toBe('boom');
    expect(normalizeThrown(42).message).toBe('42');
    expect(normalizeThrown(undefined).message).toBe('undefined');
    const original = new Error('original');
    expect(normalizeThrown(original)).toBe(original);
  });
});
