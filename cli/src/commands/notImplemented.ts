import { CliError } from '../output/errors';

export const NotImplementedCode = 'NOT_IMPLEMENTED' as const;

export function notImplemented(command: string): never {
  throw new CliError({
    code: NotImplementedCode,
    message: `Command "${command}" is not implemented yet`,
    category: 'generic',
    details: { command },
  });
}
