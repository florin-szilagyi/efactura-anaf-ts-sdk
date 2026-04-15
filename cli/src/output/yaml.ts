import { stringify } from 'yaml';
import { CliError } from './errors';
import type { OutputContext } from './types';

export function renderSuccess<T>(ctx: OutputContext, data: T): void {
  ctx.streams.stdout.write(stringify(data));
}

export function renderError(ctx: OutputContext, error: CliError | Error): void {
  const payload = {
    success: false,
    error: {
      code: error instanceof CliError ? error.code : 'GENERIC',
      message: error.message,
      ...(error instanceof CliError && error.details !== undefined ? { details: error.details } : {}),
    },
  };
  ctx.streams.stderr.write(stringify(payload));
}
