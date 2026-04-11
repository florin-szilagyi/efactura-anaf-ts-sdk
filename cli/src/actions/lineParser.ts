import { CliError } from '../output/errors';
import type { InvoiceLineAction } from './types';

export function parseInvoiceLine(raw: string): InvoiceLineAction {
  const segments = raw.split('|').map((s) => s.trim());
  if (segments.length < 4 || segments.length > 5) {
    throw badLine(raw, `expected 4 or 5 segments, got ${segments.length}`);
  }
  const [description, qtyRaw, priceRaw, taxRaw, unitCode] = segments;
  if (!description) throw badLine(raw, 'description is empty');

  const quantity = toNumber(qtyRaw, 'quantity', raw);
  const unitPrice = toNumber(priceRaw, 'unitPrice', raw);
  const taxPercent = toNumber(taxRaw, 'taxPercent', raw);

  if (quantity < 0 || unitPrice < 0 || taxPercent < 0) {
    throw badLine(raw, 'quantity, unitPrice, and taxPercent must be >= 0');
  }

  const result: InvoiceLineAction = { description, quantity, unitPrice, taxPercent };
  if (unitCode && unitCode.length > 0) {
    result.unitCode = unitCode;
  }
  return result;
}

export function parseInvoiceLines(raws: readonly string[]): InvoiceLineAction[] {
  return raws.map((raw, index) => {
    try {
      return parseInvoiceLine(raw);
    } catch (cause) {
      if (cause instanceof CliError) {
        throw new CliError({
          code: cause.code,
          message: cause.message,
          category: cause.category,
          details: { ...(cause.details ?? {}), index, raw },
        });
      }
      throw cause;
    }
  });
}

function toNumber(value: string, label: string, raw: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw badLine(raw, `${label} is not a finite number`);
  }
  return n;
}

function badLine(raw: string, reason: string): CliError {
  return new CliError({
    code: 'INVALID_LINE',
    message: `Invalid invoice line "${raw}": ${reason}`,
    category: 'user_input',
    details: { raw, reason },
  });
}
