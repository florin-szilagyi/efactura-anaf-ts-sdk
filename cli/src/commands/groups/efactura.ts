import type { Command } from 'commander';
import type { CommandDeps } from '../buildProgram';
import { notImplemented } from '../notImplemented';

export function registerEfactura(parent: Command, _deps: CommandDeps): void {
  const efactura = parent.command('efactura').description('e-Factura document operations');

  efactura
    .command('upload')
    .description('Upload an XML document to e-Factura')
    .option('--xml <path>', 'path to XML file')
    .option('--stdin', 'read XML from stdin')
    .action(() => notImplemented('efactura upload'));

  efactura
    .command('upload-b2c')
    .description('Upload a B2C XML document')
    .option('--xml <path>', 'path to XML file')
    .option('--stdin', 'read XML from stdin')
    .action(() => notImplemented('efactura upload-b2c'));

  efactura
    .command('status')
    .description('Check upload status')
    .option('--upload-id <id>', 'ANAF upload id')
    .action(() => notImplemented('efactura status'));

  efactura
    .command('download')
    .description('Download an e-Factura document by id')
    .option('--download-id <id>', 'ANAF download id')
    .option('--out <path>', 'output file path')
    .action(() => notImplemented('efactura download'));

  efactura
    .command('messages')
    .description('List recent e-Factura messages')
    .option('--days <n>', 'lookback window in days')
    .option('--filter <code>', 'message filter code')
    .option('--page <n>', 'page number')
    .option('--start-time <ms>', 'pagination start time (epoch ms)')
    .option('--end-time <ms>', 'pagination end time (epoch ms)')
    .action(() => notImplemented('efactura messages'));

  efactura
    .command('validate')
    .description('Validate an XML document via the ANAF tools service')
    .option('--xml <path>', 'path to XML file')
    .option('--standard <std>', 'standard (e.g. FACT1)')
    .action(() => notImplemented('efactura validate'));

  efactura
    .command('validate-signature')
    .description('Validate an XML signature via ANAF')
    .option('--xml <path>', 'path to XML file')
    .option('--signature <path>', 'path to signature file')
    .action(() => notImplemented('efactura validate-signature'));

  efactura
    .command('pdf')
    .description('Convert an XML document to PDF via ANAF')
    .option('--xml <path>', 'path to XML file')
    .option('--standard <std>', 'standard (e.g. FACT1)')
    .option('--no-validation', 'use the no-validation conversion endpoint')
    .option('--out <path>', 'output PDF file path')
    .action(() => notImplemented('efactura pdf'));
}
