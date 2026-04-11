import { parseInvoiceLine, parseInvoiceLines } from '../../src/actions/lineParser';
import { CliError } from '../../src/output/errors';

describe('parseInvoiceLine', () => {
  it('parses 4-segment lines', () => {
    expect(parseInvoiceLine('Servicii consultanta|1|1000|19')).toEqual({
      description: 'Servicii consultanta',
      quantity: 1,
      unitPrice: 1000,
      taxPercent: 19,
    });
  });

  it('parses 5-segment lines with unitCode', () => {
    expect(parseInvoiceLine('Cabluri|10|5.5|9|MTR')).toEqual({
      description: 'Cabluri',
      quantity: 10,
      unitPrice: 5.5,
      taxPercent: 9,
      unitCode: 'MTR',
    });
  });

  it('trims whitespace around segments', () => {
    expect(parseInvoiceLine('  Service  | 2 | 100.00 | 0  ')).toEqual({
      description: 'Service',
      quantity: 2,
      unitPrice: 100,
      taxPercent: 0,
    });
  });

  it('accepts decimal quantity, price, and tax', () => {
    const r = parseInvoiceLine('item|1.5|99.99|9.5');
    expect(r.quantity).toBe(1.5);
    expect(r.unitPrice).toBe(99.99);
    expect(r.taxPercent).toBe(9.5);
  });

  it('throws INVALID_LINE on too few segments', () => {
    let err: unknown;
    try {
      parseInvoiceLine('foo|1|2');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('INVALID_LINE');
  });

  it('throws INVALID_LINE on too many segments', () => {
    expect(() => parseInvoiceLine('a|1|2|3|MTR|extra')).toThrow(CliError);
  });

  it('throws INVALID_LINE when quantity is not a number', () => {
    expect(() => parseInvoiceLine('a|abc|2|3')).toThrow(CliError);
  });

  it('throws INVALID_LINE on negative quantity / price / tax', () => {
    expect(() => parseInvoiceLine('a|-1|2|3')).toThrow(CliError);
    expect(() => parseInvoiceLine('a|1|-2|3')).toThrow(CliError);
    expect(() => parseInvoiceLine('a|1|2|-3')).toThrow(CliError);
  });

  it('throws INVALID_LINE on empty description', () => {
    expect(() => parseInvoiceLine('|1|2|3')).toThrow(CliError);
  });
});

describe('parseInvoiceLines', () => {
  it('parses an array of strings', () => {
    const r = parseInvoiceLines(['a|1|10|19', 'b|2|20|9|MTR']);
    expect(r).toHaveLength(2);
    expect(r[1].unitCode).toBe('MTR');
  });

  it('throws on the first invalid line and includes the index in details', () => {
    let err: unknown;
    try {
      parseInvoiceLines(['a|1|10|19', 'broken']);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect(((err as CliError).details as { index: number }).index).toBe(1);
  });
});
