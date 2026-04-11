import type { Command } from 'commander';
import type { CommandDeps } from '../buildProgram';
import { notImplemented } from '../notImplemented';

export function registerCtx(parent: Command, _deps: CommandDeps): void {
  const ctx = parent.command('ctx').description('Manage company contexts');

  ctx
    .command('ls')
    .description('List all configured contexts')
    .action(() => notImplemented('ctx ls'));

  ctx
    .command('use <name>')
    .description('Set the current context')
    .action(() => notImplemented('ctx use'));

  ctx
    .command('current')
    .description('Print the current context')
    .action(() => notImplemented('ctx current'));

  ctx
    .command('add')
    .description('Add a new context')
    .option('--name <name>', 'context name')
    .option('--cui <cui>', 'company VAT number (CUI)')
    .option('--client-id <id>', 'OAuth client id')
    .option('--redirect-uri <uri>', 'OAuth redirect uri')
    .option('--env <env>', 'environment: test|prod', 'prod')
    .action(() => notImplemented('ctx add'));

  ctx
    .command('rm <name>')
    .description('Remove a context (and its token file)')
    .action(() => notImplemented('ctx rm'));

  ctx
    .command('rename <oldName> <newName>')
    .description('Rename a context')
    .action(() => notImplemented('ctx rename'));
}
