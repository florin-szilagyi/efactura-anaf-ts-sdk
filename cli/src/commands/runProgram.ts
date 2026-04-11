import { CommanderError } from 'commander';
import { buildProgram, type ServiceRegistry } from './buildProgram';
import {
  CliError,
  EXIT_CODES,
  errorToExit,
  makeOutputContext,
  renderError,
  type WriteStreams,
  type OutputFormat,
} from '../output';

export interface RunProgramOptions {
  argv: readonly string[];
  streams?: WriteStreams;
  exit?: (code: number) => void;
  services?: Partial<ServiceRegistry>;
}

export function normalizeThrown(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  return new Error(String(value));
}

function preParseFormat(argv: readonly string[]): OutputFormat {
  // The --json flag is global. We need to know it BEFORE we build
  // the OutputContext that the leaves use, so we scan argv linearly.
  // commander stops option parsing at the first `--`, so do we.
  for (const tok of argv.slice(2)) {
    if (tok === '--') return 'text';
    if (tok === '--json') return 'json';
  }
  return 'text';
}

export async function runProgram(options: RunProgramOptions): Promise<void> {
  const streams: WriteStreams = options.streams ?? { stdout: process.stdout, stderr: process.stderr };
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const format = preParseFormat(options.argv);
  const output = makeOutputContext({ format, streams });

  const program = buildProgram({
    output,
    services: (options.services ?? {}) as ServiceRegistry,
  });

  // Make commander throw instead of calling process.exit so we can
  // surface --version, --help, and validation errors through our handler.
  program.exitOverride();
  // Route commander's stderr/stdout writes through the injected streams,
  // so --version and --help land on the captured stdout in tests.
  program.configureOutput({
    writeOut: (s: string) => {
      streams.stdout.write(s);
    },
    writeErr: (s: string) => {
      streams.stderr.write(s);
    },
  });

  try {
    await program.parseAsync(options.argv as string[]);
    exit(EXIT_CODES.SUCCESS);
  } catch (raw) {
    if (raw instanceof CommanderError) {
      // commander.help and commander.version are "successful" exits
      if (raw.code === 'commander.helpDisplayed' || raw.code === 'commander.help' || raw.code === 'commander.version') {
        exit(EXIT_CODES.SUCCESS);
        return;
      }
      const wrapped = new CliError({
        code: 'BAD_USAGE',
        message: raw.message,
        category: 'user_input',
        details: { commanderCode: raw.code },
      });
      renderError(output, wrapped);
      exit(errorToExit(wrapped));
      return;
    }
    const normalized = normalizeThrown(raw);
    renderError(output, normalized);
    exit(errorToExit(normalized));
  }
}
