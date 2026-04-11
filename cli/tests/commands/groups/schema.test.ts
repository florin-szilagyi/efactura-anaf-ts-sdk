import { buildProgram } from '../../../src/commands/buildProgram';
import { makeOutputContext } from '../../../src/output';

describe('schema group', () => {
  it('registers print', () => {
    const program = buildProgram({ output: makeOutputContext({ format: 'text' }), services: {} });
    const s = program.commands.find((c) => c.name() === 'schema')!;
    expect(s.commands.map((c) => c.name())).toEqual(['print']);
  });
});
