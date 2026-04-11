import { buildProgram } from '../../../src/commands/buildProgram';
import { makeOutputContext } from '../../../src/output';

describe('ubl group', () => {
  it('registers build and inspect', () => {
    const program = buildProgram({ output: makeOutputContext({ format: 'text' }), services: {} });
    const ubl = program.commands.find((c) => c.name() === 'ubl')!;
    expect(ubl.commands.map((c) => c.name()).sort()).toEqual(['build', 'inspect']);
  });

  it('build accepts repeatable --line via the collector', () => {
    const program = buildProgram({ output: makeOutputContext({ format: 'text' }), services: {} });
    const ubl = program.commands.find((c) => c.name() === 'ubl')!;
    const build = ubl.commands.find((c) => c.name() === 'build')!;
    const lineOpt = build.options.find((o) => o.long === '--line')!;
    expect(lineOpt).toBeDefined();
    // commander stores the default; the collector will append on subsequent uses.
    expect(Array.isArray(lineOpt.defaultValue)).toBe(true);
  });
});
