import type { Command } from 'commander';
import type { OutputFormat } from '../output';

export const GLOBAL_FLAG_NAMES = ['json', 'context', 'no-color'] as const;

export interface GlobalOpts {
  json: boolean;
  context?: string;
  color: boolean;
}

export function attachGlobalFlags(program: Command): void {
  program
    .option('--json', 'machine-readable JSON output')
    .option('--context <name>', 'override the active context for this invocation')
    .option('--no-color', 'disable ANSI color (reserved; no effect in current builds)');
}

export function resolveOutputFormatFromOpts(opts: { json?: boolean }): OutputFormat {
  return opts.json === true ? 'json' : 'text';
}

export function extractGlobalOpts(program: Command): GlobalOpts {
  const raw = program.opts() as { json?: boolean; context?: string; color?: boolean };
  return {
    json: raw.json === true,
    context: raw.context,
    color: raw.color !== false, // commander turns --no-color into color: false
  };
}
