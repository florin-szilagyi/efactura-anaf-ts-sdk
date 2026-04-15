import { Command } from 'commander';
import {
  GLOBAL_FLAG_NAMES,
  attachGlobalFlags,
  resolveOutputFormatFromOpts,
  extractGlobalOpts,
} from '../../src/commands/flags';

describe('GLOBAL_FLAG_NAMES', () => {
  it('lists format, verbose, no-color', () => {
    expect(GLOBAL_FLAG_NAMES).toEqual(['format', 'verbose', 'no-color']);
  });
});

describe('attachGlobalFlags', () => {
  it('adds --format, --verbose, and --no-color to a Command', () => {
    const program = new Command();
    attachGlobalFlags(program);
    const opts = program.options.map((o) => o.long);
    expect(opts).toEqual(expect.arrayContaining(['--format', '--verbose', '--no-color']));
  });
});

describe('resolveOutputFormatFromOpts', () => {
  it('returns json when --format json', () => {
    expect(resolveOutputFormatFromOpts({ format: 'json' })).toBe('json');
  });
  it('returns yaml when --format yaml', () => {
    expect(resolveOutputFormatFromOpts({ format: 'yaml' })).toBe('yaml');
  });
  it('returns text by default', () => {
    expect(resolveOutputFormatFromOpts({})).toBe('text');
  });
  it('throws on invalid format', () => {
    expect(() => resolveOutputFormatFromOpts({ format: 'csv' })).toThrow('invalid --format');
  });
});

describe('extractGlobalOpts', () => {
  it('reads format/verbose/color from a parsed program', () => {
    const program = new Command();
    attachGlobalFlags(program);
    program.exitOverride();
    program.action(() => {
      /* no-op */
    });
    program.parse(['node', 'cli', '--format', 'json', '--verbose']);
    const g = extractGlobalOpts(program);
    expect(g).toEqual({ format: 'json', verbose: true, color: true });
  });

  it('color flips false when --no-color is given', () => {
    const program = new Command();
    attachGlobalFlags(program);
    program.exitOverride();
    program.action(() => {
      /* no-op */
    });
    program.parse(['node', 'cli', '--no-color']);
    expect(extractGlobalOpts(program).color).toBe(false);
  });
});
