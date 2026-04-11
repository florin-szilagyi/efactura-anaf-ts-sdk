import { normalizeEfacturaUploadAction } from '../../src/actions/efacturaUploadAction';
import { CliError } from '../../src/output/errors';

describe('normalizeEfacturaUploadAction', () => {
  it('accepts xmlFile source', () => {
    const action = normalizeEfacturaUploadAction({
      context: 'acme-prod',
      source: { xmlFile: '/tmp/inv.xml' },
      upload: { standard: 'UBL' },
    });
    expect(action.kind).toBe('efactura.upload');
    expect(action.source).toEqual({ type: 'xmlFile', path: '/tmp/inv.xml' });
    expect(action.upload.standard).toBe('UBL');
  });

  it('accepts xmlStdin source', () => {
    const action = normalizeEfacturaUploadAction({
      context: 'acme-prod',
      source: { xmlStdin: true },
      upload: {},
    });
    expect(action.source).toEqual({ type: 'xmlStdin' });
    expect(action.upload.standard).toBe('UBL'); // default
  });

  it('accepts ublBuild source and recursively normalizes it', () => {
    const action = normalizeEfacturaUploadAction({
      context: 'acme-prod',
      source: {
        ublBuild: {
          context: 'acme-prod',
          invoiceNumber: 'FCT-1',
          issueDate: '2026-04-11',
          customerCui: 'RO87654321',
          lines: ['x|1|1|0'],
        },
      },
      upload: { standard: 'UBL' },
    });
    expect(action.source.type).toBe('ublBuild');
    if (action.source.type === 'ublBuild') {
      expect(action.source.build.invoice.invoiceNumber).toBe('FCT-1');
    }
  });

  it('rejects sources with multiple branches set', () => {
    let err: unknown;
    try {
      normalizeEfacturaUploadAction({
        context: 'acme-prod',
        source: { xmlFile: '/tmp/x.xml', xmlStdin: true },
        upload: {},
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('INVALID_UPLOAD_INPUT');
  });

  it('rejects sources with no branch set', () => {
    expect(() =>
      normalizeEfacturaUploadAction({
        context: 'acme-prod',
        source: {},
        upload: {},
      })
    ).toThrow(CliError);
  });

  it('passes through isB2C and isExecutare', () => {
    const action = normalizeEfacturaUploadAction({
      context: 'acme-prod',
      source: { xmlStdin: true },
      upload: { isB2C: true, isExecutare: true },
    });
    expect(action.upload.isB2C).toBe(true);
    expect(action.upload.isExecutare).toBe(true);
  });
});
