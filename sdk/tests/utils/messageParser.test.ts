import { parseDetalii } from '../../src/utils/messageParser';

describe('parseDetalii', () => {
  it('parses FACTURA PRIMITA/TRIMISA with all fields', () => {
    const detalii =
      'Factura cu id_incarcare=6185977462 emisa de cif_emitent=38600525 pentru cif_beneficiar=51218787';
    expect(parseDetalii(detalii)).toEqual({
      id_incarcare: '6185977462',
      cif_emitent: '38600525',
      cif_beneficiar: '51218787',
    });
  });

  it('parses ERORI FACTURA with only id_incarcare', () => {
    const detalii =
      'Erori de validare identificate la factura primita cu id_incarcare=5001130147';
    expect(parseDetalii(detalii)).toEqual({
      id_incarcare: '5001130147',
    });
  });

  it('returns empty object for empty string', () => {
    expect(parseDetalii('')).toEqual({});
  });

  it('returns empty object for null/undefined (cast)', () => {
    expect(parseDetalii(null as unknown as string)).toEqual({});
    expect(parseDetalii(undefined as unknown as string)).toEqual({});
  });

  it('returns empty object when no known fields match', () => {
    expect(parseDetalii('some unrecognized message format')).toEqual({});
  });

  it('handles detalii with only cif_emitent', () => {
    const detalii = 'cif_emitent=12345';
    expect(parseDetalii(detalii)).toEqual({ cif_emitent: '12345' });
  });
});
