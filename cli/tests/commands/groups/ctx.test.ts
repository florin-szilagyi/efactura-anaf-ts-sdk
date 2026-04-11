import { buildProgram } from '../../../src/commands/buildProgram';
import { makeOutputContext } from '../../../src/output';

describe('ctx group', () => {
  it('registers ls, use, current, add, rm, rename', () => {
    const program = buildProgram({ output: makeOutputContext({ format: 'text' }), services: {} });
    const ctx = program.commands.find((c) => c.name() === 'ctx')!;
    expect(ctx.commands.map((c) => c.name()).sort()).toEqual(['add', 'current', 'ls', 'rename', 'rm', 'use']);
  });
});
