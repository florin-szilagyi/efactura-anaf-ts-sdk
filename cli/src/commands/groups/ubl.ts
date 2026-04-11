import type { Command } from 'commander';
import type { CommandDeps } from '../buildProgram';
import { notImplemented } from '../notImplemented';

export function registerUbl(parent: Command, _deps: CommandDeps): void {
  const ubl = parent.command('ubl').description('UBL invoice authoring');

  ubl
    .command('build')
    .description('Build a UBL invoice from flags or a structured input file')
    .option('--invoice-number <n>', 'invoice number')
    .option('--issue-date <date>', 'issue date (YYYY-MM-DD)')
    .option('--due-date <date>', 'due date (YYYY-MM-DD)')
    .option('--customer-cui <cui>', 'customer CUI')
    .option('--line <line>', 'invoice line: "desc|qty|unitPrice|taxPct[|unitCode]"', collectLine, [])
    .option('--currency <code>', 'currency code')
    .option('--payment-iban <iban>', 'payment IBAN')
    .option('--note <text>', 'free-form note')
    .option('--out <path>', 'output XML file path')
    .option('--from-json <path>', 'load invoice from a JSON file')
    .option('--from-yaml <path>', 'load invoice from a YAML file')
    .action(() => notImplemented('ubl build'));

  ubl
    .command('inspect')
    .description('Inspect a UBL XML document and emit normalized JSON')
    .option('--xml <path>', 'path to XML file')
    .action(() => notImplemented('ubl inspect'));
}

function collectLine(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
