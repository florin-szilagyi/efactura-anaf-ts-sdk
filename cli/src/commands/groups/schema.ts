import type { Command } from 'commander';
import type { CommandDeps } from '../buildProgram';
import { notImplemented } from '../notImplemented';

export function registerSchema(parent: Command, _deps: CommandDeps): void {
  const schema = parent.command('schema').description('Manifest schema utilities');

  schema
    .command('print <kind>')
    .description('Print the JSON schema for a manifest kind')
    .action(() => notImplemented('schema print'));
}
