/**
 * Access JWT test scaffolding, shared by the sync and isolation suites.
 *
 * `installAccessPlatform` swaps the two platform globals that Access verification relies on:
 * `caches.default` and `fetch` for the team JWKS. Every token carries an `email` claim by
 * default because the API now derives the row owner from it; pass `email: null` to sign a
 * token without one.
 */
export const TEAM = 'logstenia';
export const AUD = 'aud-logstenia';
export const JWKS_URL = `https://${TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`;
export const ISSUER = `https://${TEAM}.cloudflareaccess.com`;
export const DEFAULT_EMAIL = 'test@ejemplo.com';

export type JsonWebKeySet = {
  keys: (JsonWebKey & { kid?: string; alg?: string; use?: string })[];
};

export interface TokenClaims {
  aud?: string | string[];
  exp?: number;
  iss?: string;
  email?: string | null;
}

export class MemoryCache {
  private readonly entries = new Map<string, string>();

  async match(request: Request | string): Promise<Response | undefined> {
    const body = this.entries.get(cacheKey(request));
    if (body === undefined) return undefined;
    return new Response(body, { headers: { 'content-type': 'application/json' } });
  }

  async put(request: Request | string, response: Response): Promise<void> {
    this.entries.set(cacheKey(request), await response.clone().text());
  }

  get size(): number {
    return this.entries.size;
  }
}

export interface PlatformState {
  fetchCalls: string[];
  cache: MemoryCache;
}

export async function makeKeyPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
}

export async function jwksFor(keyPair: CryptoKeyPair): Promise<JsonWebKeySet> {
  const jwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
  return { keys: [{ ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }] };
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToBase64Url(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export async function signToken(
  key: CryptoKey,
  claims: TokenClaims = {},
  header: Record<string, unknown> = { alg: 'RS256', kid: 'test-kid', typ: 'JWT' },
): Promise<string> {
  const encodedHeader = jsonToBase64Url(header);
  const { email, ...rest } = claims;
  const encodedPayload = jsonToBase64Url({
    aud: AUD,
    iss: ISSUER,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...(email === null ? {} : { email: email ?? DEFAULT_EMAIL }),
    ...rest,
  });
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  return `${encodedHeader}.${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Installs the platform globals and returns the state the caller asserts on. */
export function installAccessPlatform(jwks: JsonWebKeySet): PlatformState {
  const state: PlatformState = { fetchCalls: [], cache: new MemoryCache() };

  Object.defineProperty(globalThis, 'caches', {
    value: { default: state.cache },
    configurable: true,
    writable: true,
  });

  globalThis.fetch = (async (input: Request | string | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    state.fetchCalls.push(url);
    if (url !== JWKS_URL) throw new Error(`unexpected fetch: ${url}`);
    return new Response(JSON.stringify(jwks), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
    });
  }) as typeof fetch;

  return state;
}

function cacheKey(request: Request | string): string {
  return typeof request === 'string' ? request : request.url;
}
