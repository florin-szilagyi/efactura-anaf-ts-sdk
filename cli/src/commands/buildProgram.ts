import { Command } from 'commander';
import { CLI_NAME, CLI_VERSION } from '../version';
import type { OutputContext } from '../output';
import { attachGlobalFlags } from './flags';
import { registerAuth } from './groups/auth';
import { registerCtx } from './groups/ctx';
import { registerEfactura } from './groups/efactura';
import { registerLookup } from './groups/lookup';
import { registerUbl } from './groups/ubl';
import { registerRun } from './groups/run';
import { registerSchema } from './groups/schema';

export interface ServiceRegistry {
  // Empty in P1.2. Populated incrementally by downstream workstreams:
  //   contextService?: ContextService    (P1.6)
  //   tokenStore?: TokenStore            (P1.5)
  //   authService?: AuthService          (P1.5)
  //   lookupService?: LookupService      (P1.7)
  //   ublService?: UblService            (P2.2)
  //   efacturaService?: EfacturaService  (P2.4)
  //   manifestService?: ManifestService  (P3.1)
}

export interface CommandDeps {
  output: OutputContext;
  services: ServiceRegistry;
}

export function buildProgram(deps: CommandDeps): Command {
  const program = new Command();
  program
    .name(CLI_NAME)
    .description('CLI for the ANAF e-Factura SDK')
    .version(CLI_VERSION, '-v, --version', 'print the CLI version');

  attachGlobalFlags(program);

  registerAuth(program, deps);
  registerCtx(program, deps);
  registerEfactura(program, deps);
  registerLookup(program, deps);
  registerUbl(program, deps);
  registerRun(program, deps);
  registerSchema(program, deps);

  return program;
}
