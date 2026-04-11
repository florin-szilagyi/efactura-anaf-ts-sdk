import {
  AnafAuthenticator,
  EfacturaClient,
  EfacturaToolsClient,
  TokenManager,
  type ListMessagesResponse,
  type MessageFilter,
  type PaginatedListMessagesResponse,
  type StatusResponse,
  type UploadOptions,
  type UploadResponse,
  type ValidationResult,
} from 'anaf-ts-sdk';
import { CliError } from '../output/errors';
import type { ContextService, TokenStore } from '../state';
import type { AuthService } from './authService';

/**
 * Structural subset of the SDK `TokenManager` that the service relies on.
 *
 * Defining a local interface (rather than importing the class) lets tests
 * inject a fake without dragging the SDK's private state in, and makes the
 * `finally`-block persistence contract explicit: the service only calls
 * `getRefreshToken()` after the operation to detect rotation.
 */
export interface TokenManagerLike {
  getValidAccessToken(): Promise<string>;
  getRefreshToken(): string;
}

/**
 * Builds a `TokenManagerLike` for one CLI invocation. The default factory
 * constructs a real SDK `TokenManager`; tests inject a fake so they can
 * simulate refresh-token rotation without the network.
 */
export type TokenManagerFactory = (args: {
  authenticator: AnafAuthenticator;
  refreshToken: string;
}) => TokenManagerLike;

export interface EfacturaClientFactoryArgs {
  vatNumber: string;
  testMode: boolean;
  tokenManager: TokenManagerLike;
}

/**
 * Structural subset of the SDK `EfacturaClient` that the service exercises.
 * Method signatures follow the SDK exactly so the default factory (which
 * returns the real class) satisfies the interface without adapter code.
 */
export interface EfacturaClientLike {
  uploadDocument(xml: string, options?: UploadOptions): Promise<UploadResponse>;
  uploadB2CDocument(xml: string, options?: UploadOptions): Promise<UploadResponse>;
  getUploadStatus(uploadId: string): Promise<StatusResponse>;
  downloadDocument(downloadId: string): Promise<string>;
  getMessages(params: { zile: number; filtru?: MessageFilter }): Promise<ListMessagesResponse>;
  getMessagesPaginated(params: {
    startTime: number;
    endTime: number;
    pagina: number;
    filtru?: MessageFilter;
  }): Promise<PaginatedListMessagesResponse>;
}

/**
 * Structural subset of the SDK `EfacturaToolsClient`. Kept separate so the
 * tools factory is independently mockable and so the service doesn't need
 * to know whether the underlying client requires auth.
 */
export interface EfacturaToolsClientLike {
  validateXml(xml: string, standard?: 'FACT1' | 'FCN'): Promise<ValidationResult>;
  validateSignature(
    xmlFile: Buffer | File,
    signatureFile: Buffer | File,
    xmlFileName?: string,
    signatureFileName?: string
  ): Promise<ValidationResult>;
  convertXmlToPdf(xml: string, standard?: 'FACT1' | 'FCN'): Promise<Buffer>;
  convertXmlToPdfNoValidation(xml: string, standard?: 'FACT1' | 'FCN'): Promise<Buffer>;
}

export type EfacturaClientFactory = (args: EfacturaClientFactoryArgs) => EfacturaClientLike;
export type EfacturaToolsClientFactory = (args: {
  testMode: boolean;
  tokenManager: TokenManagerLike;
}) => EfacturaToolsClientLike;

export interface EfacturaServiceOptions {
  contextService: ContextService;
  tokenStore: TokenStore;
  authService: AuthService;
  /** Factory for the SDK token manager. Tests inject a fake to drive rotation. */
  tokenManagerFactory?: TokenManagerFactory;
  /** Factory for the core SDK efactura client. Tests inject a stub. */
  clientFactory?: EfacturaClientFactory;
  /** Factory for the SDK tools client. Tests inject a stub. */
  toolsFactory?: EfacturaToolsClientFactory;
}

export interface UploadArgs {
  contextName?: string;
  xml: string;
  /** Resolved upstream via `AuthService.resolveSecret`. */
  clientSecret: string;
  isB2C?: boolean;
  options?: UploadOptions;
}

export interface StatusArgs {
  contextName?: string;
  uploadId: string;
  clientSecret: string;
}

export interface DownloadArgs {
  contextName?: string;
  downloadId: string;
  clientSecret: string;
}

export interface MessagesArgs {
  contextName?: string;
  clientSecret: string;
  days?: number;
  filter?: MessageFilter;
  startTime?: number;
  endTime?: number;
  page?: number;
}

export interface ValidateArgs {
  contextName?: string;
  clientSecret: string;
  xml: string;
  standard?: 'FACT1' | 'FCN';
}

export interface ValidateSignatureArgs {
  contextName?: string;
  clientSecret: string;
  /** Signed invoice XML content (will be uploaded as a multipart file). */
  xml: Buffer | File;
  /** Detached signature file content (multipart file). */
  signature: Buffer | File;
  xmlFilename?: string;
  signatureFilename?: string;
}

export interface PdfArgs {
  contextName?: string;
  clientSecret: string;
  xml: string;
  standard?: 'FACT1' | 'FCN';
  noValidation?: boolean;
}

/**
 * CLI-side wrapper around the SDK's `EfacturaClient` and `EfacturaToolsClient`.
 *
 * The service builds a fresh `TokenManager` per invocation, runs the SDK
 * operation, and persists any rotated refresh token back to the token store
 * in a `try/finally` block so the rotation survives both success and
 * failure. All failures coming back from the SDK are wrapped as
 * `CliError(anaf_api, <op>_FAILED)`. Authentication problems surface as
 * `CliError(auth, NO_REFRESH_TOKEN)` before any network call is attempted.
 */
export class EfacturaService {
  private readonly contextService: ContextService;
  private readonly tokenStore: TokenStore;
  private readonly tokenManagerFactory: TokenManagerFactory;
  private readonly clientFactory: EfacturaClientFactory;
  private readonly toolsFactory: EfacturaToolsClientFactory;

  constructor(opts: EfacturaServiceOptions) {
    this.contextService = opts.contextService;
    this.tokenStore = opts.tokenStore;
    this.tokenManagerFactory =
      opts.tokenManagerFactory ??
      (({ authenticator, refreshToken }): TokenManagerLike =>
        new TokenManager(authenticator, refreshToken) as unknown as TokenManagerLike);
    this.clientFactory =
      opts.clientFactory ??
      (({ vatNumber, testMode, tokenManager }): EfacturaClientLike =>
        new EfacturaClient({ vatNumber, testMode }, tokenManager as unknown as TokenManager));
    this.toolsFactory =
      opts.toolsFactory ??
      (({ testMode, tokenManager }): EfacturaToolsClientLike =>
        new EfacturaToolsClient({ testMode }, tokenManager as unknown as TokenManager));
  }

  async upload(args: UploadArgs): Promise<UploadResponse> {
    return this.withClient(args.contextName, args.clientSecret, async (client) => {
      try {
        return args.isB2C
          ? await client.uploadB2CDocument(args.xml, args.options)
          : await client.uploadDocument(args.xml, args.options);
      } catch (cause) {
        throw wrapAnafError('UPLOAD_FAILED', 'Failed to upload document', cause);
      }
    });
  }

  async getStatus(args: StatusArgs): Promise<StatusResponse> {
    return this.withClient(args.contextName, args.clientSecret, async (client) => {
      try {
        return await client.getUploadStatus(args.uploadId);
      } catch (cause) {
        throw wrapAnafError('STATUS_FAILED', 'Failed to fetch upload status', cause);
      }
    });
  }

  async download(args: DownloadArgs): Promise<Buffer> {
    return this.withClient(args.contextName, args.clientSecret, async (client) => {
      let base64: string;
      try {
        base64 = await client.downloadDocument(args.downloadId);
      } catch (cause) {
        throw wrapAnafError('DOWNLOAD_FAILED', 'Failed to download document', cause);
      }
      return Buffer.from(base64, 'base64');
    });
  }

  async getMessages(args: MessagesArgs): Promise<ListMessagesResponse | PaginatedListMessagesResponse> {
    const paginated = args.startTime !== undefined && args.endTime !== undefined && args.page !== undefined;
    const simple = args.days !== undefined;
    if (!paginated && !simple) {
      throw new CliError({
        code: 'BAD_USAGE',
        message: 'efactura messages: provide either --days OR (--start-time, --end-time, --page)',
        category: 'user_input',
      });
    }
    return this.withClient(args.contextName, args.clientSecret, async (client) => {
      try {
        if (paginated) {
          return await client.getMessagesPaginated({
            startTime: args.startTime as number,
            endTime: args.endTime as number,
            pagina: args.page as number,
            filtru: args.filter,
          });
        }
        return await client.getMessages({ zile: args.days as number, filtru: args.filter });
      } catch (cause) {
        throw wrapAnafError('MESSAGES_FAILED', 'Failed to list messages', cause);
      }
    });
  }

  // ─── tools (validation / PDF conversion) ─────────────────────────────
  //
  // The SDK's `EfacturaToolsClient` requires a valid access token, so these
  // methods still need a context + client secret even though the plan's
  // original contract described them as "unauthenticated". Tests inject a
  // fake `toolsFactory` to bypass the auth wiring; production wiring (P3.3)
  // will pass real credentials.

  async validateXml(args: ValidateArgs): Promise<ValidationResult> {
    return this.withTools(args.contextName, args.clientSecret, async (tools) => {
      try {
        return await tools.validateXml(args.xml, args.standard ?? 'FACT1');
      } catch (cause) {
        throw wrapAnafError('VALIDATION_FAILED', 'Failed to validate XML', cause);
      }
    });
  }

  async validateSignature(args: ValidateSignatureArgs): Promise<ValidationResult> {
    return this.withTools(args.contextName, args.clientSecret, async (tools) => {
      try {
        return await tools.validateSignature(args.xml, args.signature, args.xmlFilename, args.signatureFilename);
      } catch (cause) {
        throw wrapAnafError('SIGNATURE_VALIDATION_FAILED', 'Failed to validate signature', cause);
      }
    });
  }

  async convertToPdf(args: PdfArgs): Promise<Buffer> {
    return this.withTools(args.contextName, args.clientSecret, async (tools) => {
      try {
        if (args.noValidation) {
          return await tools.convertXmlToPdfNoValidation(args.xml, args.standard ?? 'FACT1');
        }
        return await tools.convertXmlToPdf(args.xml, args.standard ?? 'FACT1');
      } catch (cause) {
        throw wrapAnafError('PDF_CONVERSION_FAILED', 'Failed to convert XML to PDF', cause);
      }
    });
  }

  // ─── internals ───────────────────────────────────────────────────────

  /**
   * Run an authenticated operation against `EfacturaClient`. Resolves the
   * context, reads the refresh token, builds authenticator + token manager
   * + client, and executes `fn`. In the `finally` block, reads the (possibly
   * rotated) refresh token from the token manager and writes it back to
   * `TokenStore` if it changed — regardless of whether `fn` succeeded or
   * threw.
   */
  private async withClient<T>(
    contextName: string | undefined,
    clientSecret: string,
    fn: (client: EfacturaClientLike) => Promise<T>
  ): Promise<T> {
    const context = this.contextService.resolve(contextName);
    const refreshToken = this.readRefreshToken(context.name);
    const authenticator = this.buildAuthenticator(context.auth.clientId, clientSecret, context.auth.redirectUri);
    const tokenManager = this.tokenManagerFactory({ authenticator, refreshToken });

    const client = this.clientFactory({
      vatNumber: context.companyCui.startsWith('RO') ? context.companyCui : `RO${context.companyCui}`,
      testMode: context.environment === 'test',
      tokenManager,
    });

    try {
      return await fn(client);
    } finally {
      this.persistRotation(context.name, tokenManager, refreshToken);
    }
  }

  /**
   * Run a tools operation against `EfacturaToolsClient`. Same persistence
   * contract as `withClient`: the tools client's own token manager may
   * rotate the refresh token, and any rotation must survive success/failure.
   */
  private async withTools<T>(
    contextName: string | undefined,
    clientSecret: string,
    fn: (tools: EfacturaToolsClientLike) => Promise<T>
  ): Promise<T> {
    const context = this.contextService.resolve(contextName);
    const refreshToken = this.readRefreshToken(context.name);
    const authenticator = this.buildAuthenticator(context.auth.clientId, clientSecret, context.auth.redirectUri);
    const tokenManager = this.tokenManagerFactory({ authenticator, refreshToken });

    const tools = this.toolsFactory({
      testMode: context.environment === 'test',
      tokenManager,
    });

    try {
      return await fn(tools);
    } finally {
      this.persistRotation(context.name, tokenManager, refreshToken);
    }
  }

  private readRefreshToken(contextName: string): string {
    const refreshToken = this.tokenStore.getRefreshToken(contextName);
    if (!refreshToken) {
      throw new CliError({
        code: 'NO_REFRESH_TOKEN',
        message: `No refresh token for context "${contextName}". Run \`anaf-cli auth login\` and \`anaf-cli auth code\` first.`,
        category: 'auth',
        details: { context: contextName },
      });
    }
    return refreshToken;
  }

  private buildAuthenticator(clientId: string, clientSecret: string, redirectUri: string): AnafAuthenticator {
    return new AnafAuthenticator({ clientId, clientSecret, redirectUri });
  }

  private persistRotation(contextName: string, tokenManager: TokenManagerLike, originalRefreshToken: string): void {
    let finalRefreshToken: string;
    try {
      finalRefreshToken = tokenManager.getRefreshToken();
    } catch {
      // A failing token manager inside `finally` must not mask the real
      // error from the operation. Silently skip persistence.
      return;
    }
    if (finalRefreshToken && finalRefreshToken !== originalRefreshToken) {
      this.tokenStore.setRefreshToken(contextName, finalRefreshToken);
    }
  }
}

/**
 * Wrap an arbitrary SDK failure as a `CliError(anaf_api, <code>)`. The
 * message combines the CLI-side summary with the underlying error message
 * when available; full Error objects are NOT put in `details` because they
 * do not serialize cleanly through the JSON output envelope.
 */
function wrapAnafError(code: string, summary: string, cause: unknown): CliError {
  const message = cause instanceof Error ? `${summary}: ${cause.message}` : summary;
  return new CliError({
    code,
    message,
    category: 'anaf_api',
    details: cause instanceof Error ? { cause: cause.message } : undefined,
  });
}
