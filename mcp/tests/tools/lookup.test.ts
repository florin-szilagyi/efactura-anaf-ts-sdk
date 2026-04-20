import { describe, it, expect, jest } from '@jest/globals';
import { handleLookupCompany } from '../../src/tools/lookup.js';
import type { AnafCompanyResult } from '@florinszilagyi/anaf-ts-sdk';

describe('handleLookupCompany', () => {
  it('returns company data on successful lookup', async () => {
    const mockResult: AnafCompanyResult = {
      success: true,
      data: [
        {
          name: 'Acme SRL',
          vatCode: '12345678',
          registrationNumber: 'J40/1234/2020',
          address: 'JUD. CLUJ, CLUJ-NAPOCA, STR. TEST, NR. 1',
          postalCode: '400001',
          contactPhone: '0264123456',
          scpTva: true,
        },
      ],
    };
    const mockClient = {
      batchGetCompanyData: jest.fn<() => Promise<AnafCompanyResult>>().mockResolvedValue(mockResult),
    };
    const result = await handleLookupCompany({ cui: '12345678' }, { details: mockClient as any });
    expect(mockClient.batchGetCompanyData).toHaveBeenCalledWith(['12345678']);
    expect(result.content[0].text).toContain('Acme SRL');
    expect(result.content[0].text).toContain('12345678');
    expect(result.isError).toBeFalsy();
  });

  it('returns error content when company not found', async () => {
    const mockClient = {
      batchGetCompanyData: jest.fn<() => Promise<AnafCompanyResult>>().mockResolvedValue({ success: true, data: [] }),
    };
    const result = await handleLookupCompany({ cui: '99999999' }, { details: mockClient as any });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found|LOOKUP_NOT_FOUND/i);
  });

  it('returns error content when SDK reports failure', async () => {
    const mockClient = {
      batchGetCompanyData: jest
        .fn<() => Promise<AnafCompanyResult>>()
        .mockResolvedValue({ success: false, error: 'ANAF timeout' }),
    };
    const result = await handleLookupCompany({ cui: '12345678' }, { details: mockClient as any });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ANAF timeout');
  });
});
