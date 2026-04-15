/**
 * Parse structured fields from the ANAF message `detalii` string.
 *
 * Different message types produce different formats:
 *   FACTURA PRIMITA/TRIMISA:
 *     "Factura cu id_incarcare=6185977462 emisa de cif_emitent=38600525 pentru cif_beneficiar=51218787"
 *   ERORI FACTURA:
 *     "Erori de validare identificate la factura primita cu id_incarcare=5001130147"
 *
 * The parser is defensive — it returns only the fields it finds.
 */

export interface ParsedDetalii {
  id_incarcare?: string;
  cif_emitent?: string;
  cif_beneficiar?: string;
}

const ID_INCARCARE_RE = /id_incarcare=(\d+)/;
const CIF_EMITENT_RE = /cif_emitent=(\d+)/;
const CIF_BENEFICIAR_RE = /cif_beneficiar=(\d+)/;

export function parseDetalii(detalii: string): ParsedDetalii {
  if (!detalii) return {};

  const result: ParsedDetalii = {};

  const idMatch = ID_INCARCARE_RE.exec(detalii);
  if (idMatch) result.id_incarcare = idMatch[1];

  const emitentMatch = CIF_EMITENT_RE.exec(detalii);
  if (emitentMatch) result.cif_emitent = emitentMatch[1];

  const beneficiarMatch = CIF_BENEFICIAR_RE.exec(detalii);
  if (beneficiarMatch) result.cif_beneficiar = beneficiarMatch[1];

  return result;
}
