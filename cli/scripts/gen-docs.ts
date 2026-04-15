/**
 * Autogenerate a COMMANDS.md reference from live Commander help output.
 *
 * Usage:
 *   pnpm --filter anaf-cli exec tsx scripts/gen-docs.ts [--out COMMANDS.md]
 *
 * The script builds the Commander program in-process (no exec/spawn), walks
 * every sub-command recursively, and emits a Markdown file with:
 *   - One H2 section per top-level command group
 *   - One H3 section per leaf command
 *   - The raw help text in a fenced code block
 */

import { writeFileSync } from 'node:fs';
import { Command } from 'commander';

// ── bootstrap a headless program (no real services needed for help output) ──
// We import buildProgram directly so the script doesn't need a built binary.
import { buildProgram } from '../src/commands/buildProgram';
import { makeOutputContext } from '../src/output';
import { getXdgPaths } from '../src/state';

const noop = (): never => { throw new Error('not implemented'); };
const fakeServices = new Proxy({} as never, { get: () => noop });
const fakeOutput = makeOutputContext({ format: 'text', streams: { stdout: process.stdout, stderr: process.stderr } });

const program = buildProgram({
  output: fakeOutput,
  services: fakeServices,
  paths: getXdgPaths(),
});
// Silence commander's built-in process.exit so --help doesn't kill us
program.exitOverride();

// ── walk the command tree ────────────────────────────────────────────────────

function collectLeaves(cmd: Command, depth = 0): Array<{ cmd: Command; depth: number }> {
  const subs = cmd.commands;
  if (subs.length === 0) return [{ cmd, depth }];
  return subs.flatMap((sub) => collectLeaves(sub, depth + 1));
}

function helpBlock(cmd: Command): string {
  // helpInformation() returns the same text as --help but without exiting
  return cmd.helpInformation().trimEnd();
}

function commandPath(cmd: Command): string {
  const parts: string[] = [];
  let cur: Command | null = cmd;
  while (cur && cur.name()) {
    parts.unshift(cur.name());
    // @ts-expect-error _parent is internal
    cur = cur.parent ?? null;
  }
  return parts.join(' ');
}

// ── build markdown ───────────────────────────────────────────────────────────

const lines: string[] = [
  '<!-- AUTO-GENERATED — do not edit by hand. Run: pnpm --filter anaf-cli exec tsx scripts/gen-docs.ts -->',
  '',
  '# anaf-cli command reference',
  '',
];

// Root help first
lines.push('## Global options', '', '```', helpBlock(program), '```', '');

// Per top-level group
for (const group of program.commands) {
  const groupName = group.name();
  lines.push(`## \`${groupName}\``, '', group.description(), '');

  const leaves = collectLeaves(group);

  if (leaves.length === 1 && leaves[0].cmd === group) {
    // Single-command group (e.g. `run`)
    lines.push('```', helpBlock(group), '```', '');
  } else {
    for (const { cmd } of leaves) {
      const path = commandPath(cmd);
      lines.push(`### \`${path}\``, '', cmd.description(), '', '```', helpBlock(cmd), '```', '');
    }
  }
}

// ── write output ─────────────────────────────────────────────────────────────

const outFlag = process.argv.indexOf('--out');
const outPath = outFlag !== -1 ? process.argv[outFlag + 1] : 'COMMANDS.md';

writeFileSync(outPath, lines.join('\n'));
process.stdout.write(`Written to ${outPath}\n`);
