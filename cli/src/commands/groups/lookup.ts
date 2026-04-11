import type { Command } from 'commander';
import type { CommandDeps } from '../buildProgram';
import { notImplemented } from '../notImplemented';

export function registerLookup(parent: Command, _deps: CommandDeps): void {
  const lookup = parent.command('lookup').description('Public ANAF company lookup');

  lookup
    .command('company <cui...>')
    .description('Sync company data lookup (one or more CUIs)')
    .action(() => notImplemented('lookup company'));

  lookup
    .command('company-async <cui>')
    .description('Async company lookup with submit + poll')
    .option('--initial-delay <ms>', 'initial poll delay in ms')
    .option('--retry-delay <ms>', 'retry delay in ms')
    .option('--max-retries <n>', 'max poll attempts')
    .action(() => notImplemented('lookup company-async'));

  lookup
    .command('validate-cui <cui>')
    .description('Cheap CUI format validation')
    .action(() => notImplemented('lookup validate-cui'));
}
