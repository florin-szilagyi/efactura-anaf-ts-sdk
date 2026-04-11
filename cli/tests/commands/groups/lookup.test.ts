import { buildProgram } from '../../../src/commands/buildProgram';
import { makeOutputContext } from '../../../src/output';

describe('lookup group', () => {
  it('registers company, company-async, validate-cui', () => {
    const program = buildProgram({ output: makeOutputContext({ format: 'text' }), services: {} });
    const l = program.commands.find((c) => c.name() === 'lookup')!;
    expect(l.commands.map((c) => c.name()).sort()).toEqual(['company', 'company-async', 'validate-cui']);
  });
});
