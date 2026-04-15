import type { WriteStreams } from './types';

const REDACTED_HEADERS = new Set(['authorization']);
const BODY_PREVIEW_LIMIT = 512;

function redactHeader(name: string, value: string): string {
  if (REDACTED_HEADERS.has(name.toLowerCase())) {
    const parts = value.split(' ');
    if (parts.length === 2) return `${parts[0]} ${parts[1].slice(0, 8)}…`;
    return `${value.slice(0, 8)}…`;
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatHeaders(headers: any): string {
  if (!headers) return '';
  if (typeof headers.entries === 'function') {
    const entries: Array<[string, string]> = [...headers.entries()];
    return entries.map(([k, v]) => `  ${k}: ${redactHeader(k, v)}`).join('\n');
  }
  if (Array.isArray(headers)) {
    return (headers as Array<[string, string]>).map(([k, v]) => `  ${k}: ${redactHeader(k, v)}`).join('\n');
  }
  return Object.entries(headers as Record<string, string>)
    .map(([k, v]) => `  ${k}: ${redactHeader(k, v)}`)
    .join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bodyPreview(body: any): string | null {
  if (!body) return null;
  if (typeof body === 'string') {
    return body.length > BODY_PREVIEW_LIMIT ? `${body.slice(0, BODY_PREVIEW_LIMIT)}…(${body.length} bytes)` : body;
  }
  if (body instanceof URLSearchParams) return body.toString();
  if (typeof FormData !== 'undefined' && body instanceof FormData) return '[FormData]';
  if (body instanceof ArrayBuffer) return `[Binary ${body.byteLength} bytes]`;
  if (ArrayBuffer.isView(body)) return `[Binary ${body.byteLength} bytes]`;
  return '[stream]';
}

/**
 * Install a global fetch wrapper that logs HTTP traffic to stderr.
 * Returns a teardown function that restores the original fetch.
 */
export function installVerboseFetch(streams: WriteStreams): () => void {
  const originalFetch = globalThis.fetch;
  const log = (msg: string) => streams.stderr.write(`${msg}\n`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = async function verboseFetch(...args: any[]): Promise<Response> {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method as string) ?? 'GET';
    const start = performance.now();

    log(`\n> ${method} ${url}`);
    const headerStr = formatHeaders(init?.headers);
    if (headerStr) log(headerStr);

    const preview = bodyPreview(init?.body);
    if (preview) log(`> body: ${preview}`);

    const response: Response = await originalFetch(input, init);
    const elapsed = (performance.now() - start).toFixed(0);

    log(`< ${response.status} ${response.statusText} (${elapsed}ms)`);

    for (const name of ['content-type', 'content-length', 'x-request-id', 'location']) {
      const val = response.headers.get(name);
      if (val) log(`  ${name}: ${val}`);
    }

    return response;
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}
