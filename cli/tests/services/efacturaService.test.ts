import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EfacturaService,
  type EfacturaClientFactory,
  type EfacturaToolsClientFactory,
  type TokenManagerFactory,
} from '../../src/services/efacturaService';
import { AuthService } from '../../src/services/authService';
import { ContextService, TokenStore } from '../../src/state';
import { getXdgPaths } from '../../src/state/paths';
import { CliError } from '../../src/output/errors';
import type { Context } from '../../src/state';
import type {
  UploadResponse,
  StatusResponse,
  ListMessagesResponse,
  PaginatedListMessagesResponse,
  ValidationResult,
} from 'anaf-ts-sdk';

class FakeTokenManager {
  public refreshToken: string;
  public rotate = false;
  constructor(refreshToken: string) {
    this.refreshToken = refreshToken;
  }
  async getValidAccessToken(): Promise<string> {
    if (this.rotate) this.refreshToken = 'rt-rotated';
    return 'at-fake';
  }
  getRefreshToken(): string {
    return this.refreshToken;
  }
}

class FakeEfacturaClient {
  uploadDocument = jest.fn(
    async (): Promise<UploadResponse> => ({
      indexIncarcare: 'upload-1',
      dateResponse: '2026-04-11T18:00:00Z',
      executionStatus: '0',
    })
  );
  uploadB2CDocument = jest.fn(
    async (): Promise<UploadResponse> => ({
      indexIncarcare: 'upload-b2c-1',
      dateResponse: '2026-04-11T18:00:00Z',
      executionStatus: '0',
    })
  );
  getUploadStatus = jest.fn(
    async (): Promise<StatusResponse> => ({
      stare: 'ok',
      idDescarcare: 'download-1',
    })
  );
  downloadDocument = jest.fn(async (): Promise<string> => Buffer.from('fake-zip').toString('base64'));
  getMessages = jest.fn(async (): Promise<ListMessagesResponse> => ({ mesaje: [] }) as unknown as ListMessagesResponse);
  getMessagesPaginated = jest.fn(
    async (): Promise<PaginatedListMessagesResponse> => ({ mesaje: [] }) as unknown as PaginatedListMessagesResponse
  );
}

class FakeToolsClient {
  validateXml = jest.fn(async (): Promise<ValidationResult> => ({ valid: true, details: 'ok' }));
  validateSignature = jest.fn(async (): Promise<ValidationResult> => ({ valid: true, details: 'ok' }));
  convertXmlToPdf = jest.fn(async (): Promise<Buffer> => Buffer.from('%PDF-1.4'));
  convertXmlToPdfNoValidation = jest.fn(async (): Promise<Buffer> => Buffer.from('%PDF-1.4-noval'));
}

interface Harness {
  dir: string;
  contextService: ContextService;
  tokenStore: TokenStore;
  authService: AuthService;
  service: EfacturaService;
  fakeClient: FakeEfacturaClient;
  fakeTools: FakeToolsClient;
  getLastTokenManager: () => FakeTokenManager | undefined;
}

function harness(overrides?: {
  tokenRotate?: boolean;
  clientFactory?: EfacturaClientFactory;
  toolsFactory?: EfacturaToolsClientFactory;
}): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anaf-cli-efactura-'));
  const paths = getXdgPaths({
    configHome: path.join(dir, 'config'),
    dataHome: path.join(dir, 'data'),
    cacheHome: path.join(dir, 'cache'),
  });
  const contextService = new ContextService({ paths });
  const tokenStore = new TokenStore({ paths });
  const authService = new AuthService({
    contextService,
    tokenStore,
    authenticatorFactory: () => ({}) as never,
  });

  const fakeClient = new FakeEfacturaClient();
  const fakeTools = new FakeToolsClient();

  let lastTokenManager: FakeTokenManager | undefined;
  const tokenManagerFactory: TokenManagerFactory = ({ refreshToken }) => {
    const tm = new FakeTokenManager(refreshToken);
    if (overrides?.tokenRotate) {
      tm.rotate = true;
      // Eagerly rotate so the service's finally block sees a changed
      // refresh token without requiring the fake SDK client to call
      // getValidAccessToken().
      void tm.getValidAccessToken();
    }
    lastTokenManager = tm;
    return tm;
  };

  const clientFactory: EfacturaClientFactory = overrides?.clientFactory ?? (() => fakeClient as unknown as never);

  const toolsFactory: EfacturaToolsClientFactory = overrides?.toolsFactory ?? (() => fakeTools as unknown as never);

  const service = new EfacturaService({
    contextService,
    tokenStore,
    authService,
    tokenManagerFactory,
    clientFactory,
    toolsFactory,
  });

  return {
    dir,
    contextService,
    tokenStore,
    authService,
    service,
    fakeClient,
    fakeTools,
    getLastTokenManager: () => lastTokenManager,
  };
}

const sampleCtx = (): Context => ({
  name: 'acme-prod',
  companyCui: 'RO12345678',
  environment: 'prod',
  auth: { clientId: 'cid', redirectUri: 'https://localhost/cb' },
});

describe('EfacturaService.upload', () => {
  it('uploads via EfacturaClient and returns the SDK response', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt-original' });

    const result = await h.service.upload({
      xml: '<xml/>',
      clientSecret: 'secret-1',
    });

    expect(result.indexIncarcare).toBe('upload-1');
    expect(h.fakeClient.uploadDocument).toHaveBeenCalledTimes(1);
    expect(h.fakeClient.uploadDocument).toHaveBeenCalledWith('<xml/>', undefined);
  });

  it('calls uploadB2CDocument when isB2C is true', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt-original' });

    const result = await h.service.upload({
      xml: '<xml/>',
      clientSecret: 'secret-1',
      isB2C: true,
    });

    expect(result.indexIncarcare).toBe('upload-b2c-1');
    expect(h.fakeClient.uploadB2CDocument).toHaveBeenCalledTimes(1);
    expect(h.fakeClient.uploadDocument).not.toHaveBeenCalled();
  });

  it('persists rotated refresh token after a successful call', async () => {
    const h = harness({ tokenRotate: true });
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt-original' });

    await h.service.upload({ xml: '<xml/>', clientSecret: 'secret-1' });
    expect(h.tokenStore.read('acme-prod')?.refreshToken).toBe('rt-rotated');
  });

  it('persists rotated refresh token even when the operation fails', async () => {
    // Build a harness whose clientFactory forces rotation BEFORE failure,
    // then returns a client that rejects the upload call. This exercises
    // the try/finally contract: the finally block must still persist the
    // rotated refresh token even though the operation threw.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anaf-cli-efactura-'));
    const paths = getXdgPaths({
      configHome: path.join(dir, 'config'),
      dataHome: path.join(dir, 'data'),
      cacheHome: path.join(dir, 'cache'),
    });
    const contextService = new ContextService({ paths });
    const tokenStore = new TokenStore({ paths });
    const authService = new AuthService({
      contextService,
      tokenStore,
      authenticatorFactory: () => ({}) as never,
    });
    contextService.add(sampleCtx());
    contextService.setCurrent('acme-prod');
    tokenStore.write('acme-prod', { refreshToken: 'rt-original' });

    const fakeClient = new FakeEfacturaClient();
    fakeClient.uploadDocument.mockImplementationOnce(async () => {
      // Simulate the SDK calling getValidAccessToken -> rotate -> then fail.
      throw new Error('upload boom');
    });

    const service = new EfacturaService({
      contextService,
      tokenStore,
      authService,
      tokenManagerFactory: ({ refreshToken }) => {
        const tm = new FakeTokenManager(refreshToken);
        tm.rotate = true;
        // Simulate rotation happening during the op by pre-flipping the
        // refresh token on the manager instance (as if getValidAccessToken
        // had been called and rotation occurred).
        void tm.getValidAccessToken();
        return tm;
      },
      clientFactory: () => fakeClient as unknown as never,
      toolsFactory: () => new FakeToolsClient() as unknown as never,
    });

    await expect(service.upload({ xml: '<xml/>', clientSecret: 'secret-1' })).rejects.toBeInstanceOf(CliError);
    // Token was rotated (by getValidAccessToken) before the failure, must
    // be persisted by the try/finally block.
    expect(tokenStore.read('acme-prod')?.refreshToken).toBe('rt-rotated');
  });

  it('does not write when the refresh token did not rotate', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt-stable' });

    await h.service.upload({ xml: '<xml/>', clientSecret: 's' });
    expect(h.tokenStore.read('acme-prod')?.refreshToken).toBe('rt-stable');
  });

  it('throws CliError(auth, NO_REFRESH_TOKEN) when no token is persisted', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    let err: unknown;
    try {
      await h.service.upload({ xml: '<xml/>', clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).category).toBe('auth');
    expect((err as CliError).code).toBe('NO_REFRESH_TOKEN');
  });

  it('wraps SDK upload failure as UPLOAD_FAILED', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    h.fakeClient.uploadDocument.mockRejectedValueOnce(new Error('network boom'));
    let err: unknown;
    try {
      await h.service.upload({ xml: '<xml/>', clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).category).toBe('anaf_api');
    expect((err as CliError).code).toBe('UPLOAD_FAILED');
  });

  it('forwards UploadOptions to the SDK', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    await h.service.upload({
      xml: '<xml/>',
      clientSecret: 's',
      options: { extern: true },
    });
    expect(h.fakeClient.uploadDocument).toHaveBeenCalledWith('<xml/>', { extern: true });
  });

  it('prefixes companyCui with RO when missing', async () => {
    const h = harness({
      clientFactory: (args) => {
        expect(args.vatNumber).toBe('RO12345678');
        return new FakeEfacturaClient() as unknown as never;
      },
    });
    h.contextService.add({
      name: 'acme-prod',
      companyCui: '12345678',
      environment: 'prod',
      auth: { clientId: 'cid', redirectUri: 'https://localhost/cb' },
    });
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    await h.service.upload({ xml: '<xml/>', clientSecret: 's' });
  });

  it('does not double-prefix companyCui that already starts with RO', async () => {
    const h = harness({
      clientFactory: (args) => {
        expect(args.vatNumber).toBe('RO12345678');
        return new FakeEfacturaClient() as unknown as never;
      },
    });
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    await h.service.upload({ xml: '<xml/>', clientSecret: 's' });
  });

  it('derives testMode=true from environment=test', async () => {
    const h = harness({
      clientFactory: (args) => {
        expect(args.testMode).toBe(true);
        return new FakeEfacturaClient() as unknown as never;
      },
    });
    h.contextService.add({
      name: 'acme-test',
      companyCui: 'RO12345678',
      environment: 'test',
      auth: { clientId: 'cid', redirectUri: 'https://localhost/cb' },
    });
    h.contextService.setCurrent('acme-test');
    h.tokenStore.write('acme-test', { refreshToken: 'rt' });
    await h.service.upload({ xml: '<xml/>', clientSecret: 's' });
  });

  it('derives testMode=false from environment=prod', async () => {
    const h = harness({
      clientFactory: (args) => {
        expect(args.testMode).toBe(false);
        return new FakeEfacturaClient() as unknown as never;
      },
    });
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    await h.service.upload({ xml: '<xml/>', clientSecret: 's' });
  });
});

describe('EfacturaService.getStatus', () => {
  it('returns the SDK status and calls the SDK with the uploadId', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    const result = await h.service.getStatus({ uploadId: 'upload-1', clientSecret: 's' });
    expect(result.stare).toBe('ok');
    expect(h.fakeClient.getUploadStatus).toHaveBeenCalledWith('upload-1');
  });

  it('wraps SDK status failure as STATUS_FAILED', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    h.fakeClient.getUploadStatus.mockRejectedValueOnce(new Error('boom'));
    let err: unknown;
    try {
      await h.service.getStatus({ uploadId: 'upload-1', clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('STATUS_FAILED');
    expect((err as CliError).category).toBe('anaf_api');
  });
});

describe('EfacturaService.download', () => {
  it('decodes the base64 payload to a Buffer', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    const buf = await h.service.download({ downloadId: 'download-1', clientSecret: 's' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString('utf8')).toBe('fake-zip');
  });

  it('wraps SDK download failure as DOWNLOAD_FAILED', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    h.fakeClient.downloadDocument.mockRejectedValueOnce(new Error('boom'));
    let err: unknown;
    try {
      await h.service.download({ downloadId: 'download-1', clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('DOWNLOAD_FAILED');
  });
});

describe('EfacturaService.getMessages', () => {
  it('routes to simple listing when days is set', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    await h.service.getMessages({ days: 7, clientSecret: 's' });
    expect(h.fakeClient.getMessages).toHaveBeenCalledWith({ zile: 7, filtru: undefined });
    expect(h.fakeClient.getMessagesPaginated).not.toHaveBeenCalled();
  });

  it('routes to paginated when start/end/page are set', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    await h.service.getMessages({
      startTime: 1000,
      endTime: 2000,
      page: 1,
      clientSecret: 's',
    });
    expect(h.fakeClient.getMessagesPaginated).toHaveBeenCalledWith({
      startTime: 1000,
      endTime: 2000,
      pagina: 1,
      filtru: undefined,
    });
    expect(h.fakeClient.getMessages).not.toHaveBeenCalled();
  });

  it('throws BAD_USAGE when neither pattern is satisfied', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    let err: unknown;
    try {
      await h.service.getMessages({ clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).category).toBe('user_input');
    expect((err as CliError).code).toBe('BAD_USAGE');
  });

  it('throws BAD_USAGE on partial pagination inputs', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    let err: unknown;
    try {
      await h.service.getMessages({ startTime: 1, endTime: 2, clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('BAD_USAGE');
  });

  it('wraps SDK messages failure as MESSAGES_FAILED', async () => {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    h.fakeClient.getMessages.mockRejectedValueOnce(new Error('boom'));
    let err: unknown;
    try {
      await h.service.getMessages({ days: 7, clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('MESSAGES_FAILED');
  });
});

describe('EfacturaService tools', () => {
  function toolsHarness(): Harness {
    const h = harness();
    h.contextService.add(sampleCtx());
    h.contextService.setCurrent('acme-prod');
    h.tokenStore.write('acme-prod', { refreshToken: 'rt' });
    return h;
  }

  it('validateXml delegates to the tools client with default FACT1', async () => {
    const h = toolsHarness();
    const r = await h.service.validateXml({ xml: '<x/>', clientSecret: 's' });
    expect(r.valid).toBe(true);
    expect(h.fakeTools.validateXml).toHaveBeenCalledWith('<x/>', 'FACT1');
  });

  it('validateXml forwards custom standard', async () => {
    const h = toolsHarness();
    await h.service.validateXml({ xml: '<x/>', standard: 'FCN', clientSecret: 's' });
    expect(h.fakeTools.validateXml).toHaveBeenCalledWith('<x/>', 'FCN');
  });

  it('validateSignature delegates with all params', async () => {
    const h = toolsHarness();
    const xmlBuf = Buffer.from('<x/>');
    const sigBuf = Buffer.from('<sig/>');
    await h.service.validateSignature({
      xml: xmlBuf,
      signature: sigBuf,
      xmlFilename: 'i.xml',
      signatureFilename: 's.xml',
      clientSecret: 's',
    });
    expect(h.fakeTools.validateSignature).toHaveBeenCalledWith(xmlBuf, sigBuf, 'i.xml', 's.xml');
  });

  it('convertToPdf routes to convertXmlToPdf by default', async () => {
    const h = toolsHarness();
    await h.service.convertToPdf({ xml: '<x/>', clientSecret: 's' });
    expect(h.fakeTools.convertXmlToPdf).toHaveBeenCalledWith('<x/>', 'FACT1');
    expect(h.fakeTools.convertXmlToPdfNoValidation).not.toHaveBeenCalled();
  });

  it('convertToPdf routes to convertXmlToPdfNoValidation when noValidation=true', async () => {
    const h = toolsHarness();
    await h.service.convertToPdf({ xml: '<x/>', noValidation: true, clientSecret: 's' });
    expect(h.fakeTools.convertXmlToPdfNoValidation).toHaveBeenCalledWith('<x/>', 'FACT1');
    expect(h.fakeTools.convertXmlToPdf).not.toHaveBeenCalled();
  });

  it('wraps tools validation failures as VALIDATION_FAILED', async () => {
    const h = toolsHarness();
    h.fakeTools.validateXml.mockRejectedValueOnce(new Error('boom'));
    let err: unknown;
    try {
      await h.service.validateXml({ xml: '<x/>', clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('VALIDATION_FAILED');
    expect((err as CliError).category).toBe('anaf_api');
  });

  it('wraps signature validation failure as SIGNATURE_VALIDATION_FAILED', async () => {
    const h = toolsHarness();
    h.fakeTools.validateSignature.mockRejectedValueOnce(new Error('boom'));
    let err: unknown;
    try {
      await h.service.validateSignature({
        xml: Buffer.from('<x/>'),
        signature: Buffer.from('<sig/>'),
        clientSecret: 's',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('SIGNATURE_VALIDATION_FAILED');
  });

  it('wraps PDF conversion failure as PDF_CONVERSION_FAILED', async () => {
    const h = toolsHarness();
    h.fakeTools.convertXmlToPdf.mockRejectedValueOnce(new Error('boom'));
    let err: unknown;
    try {
      await h.service.convertToPdf({ xml: '<x/>', clientSecret: 's' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).code).toBe('PDF_CONVERSION_FAILED');
  });
});
