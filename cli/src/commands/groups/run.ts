import type { Command } from 'commander';
import type { CommandDeps } from '../buildProgram';
import { notImplemented } from '../notImplemented';

export function registerRun(parent: Command, _deps: CommandDeps): void {
  parent
    .command('run')
    .description('Execute a manifest file (YAML or JSON)')
    .option('-f, --file <path>', 'path to the manifest file')
    .option('--dry-run', 'normalize the action but do not execute')
    .action(() => notImplemented('run'));
}
