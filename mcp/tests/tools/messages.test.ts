import { describe, it, expect, jest } from '@jest/globals';
import { handleListMessages } from '../../src/tools/messages.js';
import { MessageFilter } from '@florinszilagyi/anaf-ts-sdk';

describe('handleListMessages', () => {
  it('calls getMessages with days-based params', async () => {
    const mockClient = {
      getMessages: jest.fn<() => Promise<{ mesaje: unknown[] }>>().mockResolvedValue({
        mesaje: [{ id: '1', tip: 'FACTURA PRIMITA', data_creare: '20260415', detalii: 'x' }],
      }),
      getMessagesPaginated: jest.fn<() => Promise<never>>(),
    };
    const result = await handleListMessages({ days: 30, filter: 'received' }, { efactura: mockClient as any });
    expect(mockClient.getMessages).toHaveBeenCalledWith({ zile: 30, filtru: MessageFilter.InvoiceReceived });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('FACTURA PRIMITA');
  });

  it('calls getMessagesPaginated when start_time/end_time/page provided', async () => {
    const mockClient = {
      getMessages: jest.fn<() => Promise<never>>(),
      getMessagesPaginated: jest
        .fn<() => Promise<{ mesaje: unknown[]; numar_total_pagini: number }>>()
        .mockResolvedValue({ mesaje: [], numar_total_pagini: 0 }),
    };
    const result = await handleListMessages(
      { start_time: 1700000000000, end_time: 1702000000000, page: 1, filter: 'sent' },
      { efactura: mockClient as any }
    );
    expect(mockClient.getMessagesPaginated).toHaveBeenCalledWith({
      startTime: 1700000000000,
      endTime: 1702000000000,
      pagina: 1,
      filtru: MessageFilter.InvoiceSent,
    });
    expect(result.isError).toBeFalsy();
  });

  it('rejects when neither days nor pagination args provided', async () => {
    const mockClient = {
      getMessages: jest.fn<() => Promise<never>>(),
      getMessagesPaginated: jest.fn<() => Promise<never>>(),
    };
    const result = await handleListMessages({}, { efactura: mockClient as any });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/BAD_USAGE|provide/i);
  });

  it('maps all filter aliases to SDK codes', async () => {
    const mockClient = {
      getMessages: jest.fn<() => Promise<{ mesaje: unknown[] }>>().mockResolvedValue({ mesaje: [] }),
      getMessagesPaginated: jest.fn<() => Promise<never>>(),
    };
    const cases: Array<[string, MessageFilter]> = [
      ['sent', MessageFilter.InvoiceSent],
      ['received', MessageFilter.InvoiceReceived],
      ['errors', MessageFilter.InvoiceErrors],
      ['buyer', MessageFilter.BuyerMessage],
    ];
    for (const [alias, code] of cases) {
      await handleListMessages({ days: 1, filter: alias as any }, { efactura: mockClient as any });
      expect(mockClient.getMessages).toHaveBeenLastCalledWith({ zile: 1, filtru: code });
    }
  });
});
