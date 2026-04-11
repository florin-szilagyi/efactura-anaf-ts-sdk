import { Command } from 'commander';
import {
  GLOBAL_FLAG_NAMES,
  attachGlobalFlags,
  resolveOutputFormatFromOpts,
  extractGlobalOpts,
} from '../../src/commands/flags';

describe('GLOBAL_FLAG_NAMES', () => {
  it('lists json, context, no-color', () => {
    expect(GLOBAL_FLAG_NAMES).toEqual(['json', 'context', 'no-color']);
  });
});

describe('attachGlobalFlags', () => {
  it('adds --json, --context <name>, and --no-color to a Command', () => {
    const program = new Command();
    attachGlobalFlags(program);
    const opts = program.options.map((o) => o.long);
    expect(opts).toEqual(expect.arrayContaining(['--json', '--context', '--no-color']));
  });
});

describe('resolveOutputFormatFromOpts', () => {
  it('returns json when --json is set', () => {
    expect(resolveOutputFormatFromOpts({ json: true })).toBe('json');
  });
  it('returns text when --json is unset or false', () => {
    expect(resolveOutputFormatFromOpts({})).toBe('text');
    expect(resolveOutputFormatFromOpts({ json: false })).toBe('text');
  });
});

describe('extractGlobalOpts', () => {
  it('reads json/context/color from a parsed program', () => {
    const program = new Command();
    attachGlobalFlags(program);
    program.exitOverride();
    program.action(() => {
      /* no-op */
    });
    program.parse(['node', 'cli', '--json', '--context', 'acme-prod']);
    const g = extractGlobalOpts(program);
    expect(g).toEqual({ json: true, context: 'acme-prod', color: true });
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
