import { AnafDetailsClient } from '../AnafDetailsClient';
import type { MessageDetails } from '../types';

/**
 * Enrich messages that have a `cif_emitent` field with the emitter's company name.
 *
 * Collects all unique emitter CUIs, performs a single batch lookup via
 * `AnafDetailsClient.batchGetCompanyData`, and sets `emitentName` on each
 * message where a match is found.
 *
 * Graceful degradation: if the batch lookup fails, the original response
 * is returned unchanged (no `emitentName` fields).
 */
export async function enrichMessagesWithCompanyData<T extends { mesaje?: MessageDetails[] }>(
  response: T,
  detailsClient: AnafDetailsClient,
): Promise<T> {
  if (!response.mesaje || response.mesaje.length === 0) {
    return response;
  }

  const uniqueCuis = [
    ...new Set(
      response.mesaje
        .map((m) => m.cif_emitent)
        .filter((cui): cui is string => Boolean(cui)),
    ),
  ];

  if (uniqueCuis.length === 0) {
    return response;
  }

  try {
    const result = await detailsClient.batchGetCompanyData(uniqueCuis);
    if (!result.success || !result.data) {
      return response;
    }

    const nameMap = new Map<string, string>();
    for (const company of result.data) {
      nameMap.set(company.vatCode, company.name);
    }

    return {
      ...response,
      mesaje: response.mesaje.map((msg) => {
        if (msg.cif_emitent && nameMap.has(msg.cif_emitent)) {
          return { ...msg, emitentName: nameMap.get(msg.cif_emitent) };
        }
        return msg;
      }),
    };
  } catch {
    return response;
  }
}
