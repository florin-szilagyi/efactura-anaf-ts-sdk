import type { Command } from 'commander';
import type { CommandDeps } from '../buildProgram';
import { notImplemented } from '../notImplemented';

export function registerAuth(parent: Command, _deps: CommandDeps): void {
  const auth = parent.command('auth').description('OAuth authentication against ANAF');

  auth
    .command('login')
    .description('Start the OAuth authorization flow for the active context')
    .action(() => notImplemented('auth login'));

  auth
    .command('code')
    .description('Exchange a pasted authorization code for tokens')
    .action(() => notImplemented('auth code'));

  auth
    .command('refresh')
    .description('Force a refresh of the active context tokens')
    .action(() => notImplemented('auth refresh'));

  auth
    .command('whoami')
    .description('Print the active context and token freshness')
    .action(() => notImplemented('auth whoami'));

  auth
    .command('logout')
    .description('Discard tokens for the active context')
    .action(() => notImplemented('auth logout'));
}
