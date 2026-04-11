import { Writable } from 'node:stream';
import { renderSuccess, renderError, makeOutputContext, CliError } from '../../src/output';

class Cap extends Writable {
  buf = '';
  _write(c: Buffer, _e: BufferEncoding, cb: (e?: Error | null) => void): void {
    this.buf += c.toString('utf8');
    cb();
  }
}

describe('output barrel renderSuccess dispatch', () => {
  it('routes to text in text mode', () => {
    const out = new Cap();
    const err = new Cap();
    const ctx = makeOutputContext({ format: 'text', streams: { stdout: out, stderr: err } });
    renderSuccess(ctx, { name: 'acme' }, (d) => `name=${d.name}`);
    expect(out.buf).toBe('name=acme\n');
  });

  it('routes to JSON in json mode', () => {
    const out = new Cap();
    const err = new Cap();
    const ctx = makeOutputContext({ format: 'json', streams: { stdout: out, stderr: err } });
    renderSuccess(ctx, { name: 'acme' });
    expect(JSON.parse(out.buf)).toEqual({ success: true, data: { name: 'acme' } });
  });
});

describe('output barrel renderError dispatch', () => {
  it('text mode prints "code: message" to stderr', () => {
    const out = new Cap();
    const err = new Cap();
    const ctx = makeOutputContext({ format: 'text', streams: { stdout: out, stderr: err } });
    renderError(ctx, new CliError({ code: 'X', message: 'y', category: 'generic' }));
    expect(err.buf).toBe('X: y\n');
  });

  it('json mode prints the error envelope to stderr', () => {
    const out = new Cap();
    const err = new Cap();
    const ctx = makeOutputContext({ format: 'json', streams: { stdout: out, stderr: err } });
    renderError(ctx, new CliError({ code: 'X', message: 'y', category: 'generic' }));
    expect(JSON.parse(err.buf)).toEqual({ success: false, error: { code: 'X', message: 'y' } });
  });
});
