import type { Command } from 'commander';
import type { OutputFormat } from '../output';

export const GLOBAL_FLAG_NAMES = ['format', 'verbose', 'no-color'] as const;

export interface GlobalOpts {
  format?: string;
  verbose: boolean;
  color: boolean;
}

const VALID_FORMATS: ReadonlySet<string> = new Set(['text', 'json', 'yaml']);

export function attachGlobalFlags(program: Command): void {
  program
    .option('--format <fmt>', 'output format: text, json, or yaml (default: text)')
    .option('--verbose', 'show HTTP requests and responses')
    .option('--no-color', 'disable ANSI color (reserved; no effect in current builds)');
}

export function resolveOutputFormatFromOpts(opts: { format?: string }): OutputFormat {
  if (opts.format) {
    if (!VALID_FORMATS.has(opts.format)) {
      throw new Error(`invalid --format "${opts.format}": expected text, json, or yaml`);
    }
    return opts.format as OutputFormat;
  }
  return 'text';
}

export function extractGlobalOpts(program: Command): GlobalOpts {
  const raw = program.opts() as { format?: string; verbose?: boolean; color?: boolean };
  return {
    format: raw.format,
    verbose: raw.verbose === true,
    color: raw.color !== false,
  };
}
