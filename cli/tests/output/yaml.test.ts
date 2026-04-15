import { Writable } from 'node:stream';
import { parse as parseYaml } from 'yaml';
import { renderSuccess, renderError } from '../../src/output/yaml';
import { CliError } from '../../src/output/errors';
import type { OutputContext } from '../../src/output/types';

class CaptureStream extends Writable {
  chunks: string[] = [];
  _write(chunk: Buffer, _enc: BufferEncoding, cb: (e?: Error | null) => void): void {
    this.chunks.push(chunk.toString('utf8'));
    cb();
  }
  text(): string {
    return this.chunks.join('');
  }
}

function ctx(): { ctx: OutputContext; out: CaptureStream; err: CaptureStream } {
  const out = new CaptureStream();
  const err = new CaptureStream();
  return { ctx: { format: 'yaml', streams: { stdout: out, stderr: err } }, out, err };
}

describe('yaml renderSuccess', () => {
  it('writes YAML to stdout', () => {
    const { ctx: c, out } = ctx();
    renderSuccess(c, { name: 'acme', cui: 'RO12345678' });
    const parsed = parseYaml(out.text());
    expect(parsed).toEqual({ name: 'acme', cui: 'RO12345678' });
  });

  it('handles arrays', () => {
    const { ctx: c, out } = ctx();
    renderSuccess(c, [1, 2, 3]);
    expect(parseYaml(out.text())).toEqual([1, 2, 3]);
  });
});

describe('yaml renderError', () => {
  it('serializes a CliError to stderr as YAML', () => {
    const { ctx: c, err } = ctx();
    renderError(
      c,
      new CliError({
        code: 'AUTH_FAILED',
        message: 'refresh token expired',
        category: 'auth',
        details: { context: 'acme-prod' },
      })
    );
    const parsed = parseYaml(err.text());
    expect(parsed).toEqual({
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message: 'refresh token expired',
        details: { context: 'acme-prod' },
      },
    });
  });

  it('serializes a plain Error with code GENERIC', () => {
    const { ctx: c, err } = ctx();
    renderError(c, new Error('boom'));
    expect(parseYaml(err.text())).toEqual({
      success: false,
      error: { code: 'GENERIC', message: 'boom' },
    });
  });
});
