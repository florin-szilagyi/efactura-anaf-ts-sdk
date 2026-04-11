import { buildProgram } from '../../../src/commands/buildProgram';
import { makeOutputContext } from '../../../src/output';

function helpFor(group: string): string {
  const program = buildProgram({ output: makeOutputContext({ format: 'text' }), services: {} });
  const cmd = program.commands.find((c) => c.name() === group);
  if (!cmd) throw new Error(`group ${group} not registered`);
  return cmd.helpInformation();
}

describe('auth group', () => {
  it('registers login, code, refresh, whoami, logout', () => {
    const program = buildProgram({ output: makeOutputContext({ format: 'text' }), services: {} });
    const auth = program.commands.find((c) => c.name() === 'auth')!;
    expect(auth.commands.map((c) => c.name()).sort()).toEqual(['code', 'login', 'logout', 'refresh', 'whoami']);
  });

  it('--help renders all five subcommands', () => {
    const help = helpFor('auth');
    for (const sub of ['login', 'code', 'refresh', 'whoami', 'logout']) {
      expect(help).toContain(sub);
    }
  });
});
