/**
 * Cloudflare Access identity (`design-plans/backend-sync.md` §5, `multi-user.md` §1).
 *
 * A Worker with Static Assets never receives `ctx.access`, so the platform hands us no
 * verified identity: the `Cf-Access-Jwt-Assertion` header must be validated here (signature
 * against the team JWKS, plus `aud` and `exp`) or an unauthenticated caller could reach
 * `/api/*` directly. The JWKS is fetched once and cached with `caches.default`, so the common
 * path costs no subrequest.
 *
 * Since multi-user sync the call returns the caller's identity instead of a boolean: the row
 * owner is derived from the `email` claim of an already verified token. The claim is read
 * only after the signature checks out; a header such as
 * `Cf-Access-Authenticated-User-Email` is never trusted on its own.
 */

const JWKS_PATH = '/cdn-cgi/access/certs';
const JWKS_MAX_AGE_SECONDS = 3600;
const CLOCK_SKEW_SECONDS = 30;
const ALLOWED_ALGORITHM = 'RS256';

/** Development only: the owner a request claims under the loopback bypass. */
export const DEV_OWNER_HEADER = 'x-dev-owner';
export const DEFAULT_DEV_EMAIL = 'dev@local';

export interface AccessEnv {
  CF_ACCESS_TEAM: string;
  CF_ACCESS_AUD: string;
  /** Only `npm run dev` sets this; a deployed Worker never carries it. */
  SYNC_DEV_NO_AUTH?: string;
}

export interface Identity {
  /** Normalized owner of every row this request reads or writes. */
  email: string;
}

export type AccessReason =
  | 'missing_token'
  | 'malformed'
  | 'expired'
  | 'wrong_audience'
  | 'invalid_signature'
  | 'no_email';

export type AccessResult =
  | { ok: true; identity: Identity }
  | { ok: false; reason: AccessReason };

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Local development escape hatch (`worker/README.md`).
 *
 * `npm run dev` passes `--var SYNC_DEV_NO_AUTH:true`, so a loopback request skips Access
 * verification and the client can be exercised against `wrangler dev` without a Cloudflare
 * session. Two conditions are required on purpose: the exact flag and a loopback host. A
 * deployed Worker has neither (the flag is not in `wrangler.toml`, and its hostname is not
 * loopback), so it keeps failing closed.
 */
export function isDevAuthBypass(request: Request, env: AccessEnv): boolean {
  if (env.SYNC_DEV_NO_AUTH !== 'true') return false;
  return LOOPBACK_HOSTS.has(new URL(request.url).hostname);
}

/** The single place an owner string is derived, so casing can never fork a person's rows. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Resolves the caller's identity.
 *
 * Under the loopback bypass the owner comes from `x-dev-owner` (default `dev@local`): that
 * header is read on this branch only, so a deployed Worker ignores it entirely.
 */
export async function authenticate(request: Request, env: AccessEnv): Promise<AccessResult> {
  if (isDevAuthBypass(request, env)) {
    const claimed = request.headers.get(DEV_OWNER_HEADER) ?? DEFAULT_DEV_EMAIL;
    const email = normalizeEmail(claimed);
    if (email === '') return { ok: false, reason: 'no_email' };
    return { ok: true, identity: { email } };
  }

  return verifyAccessJwt(request, env);
}

interface AccessClaims {
  aud?: string | string[];
  exp?: number;
  email?: unknown;
}

interface JwksResponse {
  keys?: (JsonWebKey & { kid?: string })[];
}

async function verifyAccessJwt(request: Request, env: AccessEnv): Promise<AccessResult> {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { ok: false, reason: 'missing_token' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  const header = decodeJson(headerPart) as { alg?: string; kid?: string } | null;
  const claims = decodeJson(payloadPart) as AccessClaims | null;
  if (!header || !claims) return { ok: false, reason: 'malformed' };
  if (header.alg !== ALLOWED_ALGORITHM) return { ok: false, reason: 'malformed' };
  if (!hasLiveSession(claims)) return { ok: false, reason: 'expired' };
  if (!matchesAudience(claims, env)) return { ok: false, reason: 'wrong_audience' };

  if (!(await hasValidSignature(header, signaturePart, headerPart, payloadPart, env))) {
    return { ok: false, reason: 'invalid_signature' };
  }

  // Identity is read only from a token whose signature and audience already checked out.
  if (typeof claims.email !== 'string') return { ok: false, reason: 'no_email' };
  const email = normalizeEmail(claims.email);
  if (email === '') return { ok: false, reason: 'no_email' };

  return { ok: true, identity: { email } };
}

async function hasValidSignature(
  header: { kid?: string },
  signaturePart: string,
  headerPart: string,
  payloadPart: string,
  env: AccessEnv,
): Promise<boolean> {
  try {
    const keys = await loadTeamJwks(env);
    const jwk = keys.find((key) => key.kty === 'RSA' && (!header.kid || key.kid === header.kid));
    if (!jwk) return false;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
  } catch {
    return false;
  }
}

function hasLiveSession(claims: AccessClaims): boolean {
  if (typeof claims.exp !== 'number') return false;
  return claims.exp * 1000 + CLOCK_SKEW_SECONDS * 1000 > Date.now();
}

function matchesAudience(claims: AccessClaims, env: AccessEnv): boolean {
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return audiences.includes(env.CF_ACCESS_AUD);
}

async function loadTeamJwks(env: AccessEnv): Promise<(JsonWebKey & { kid?: string })[]> {
  const url = `https://${env.CF_ACCESS_TEAM}.cloudflareaccess.com${JWKS_PATH}`;
  const cache = defaultCache();
  const cacheKey = new Request(url, { method: 'GET' });

  const cached = await cache?.match(cacheKey);
  if (cached) return parseJwks(await cached.text());

  const response = await fetch(url);
  if (!response.ok) return [];
  const body = await response.text();

  if (cache) {
    const headers = new Headers(response.headers);
    headers.set('cache-control', `public, max-age=${JWKS_MAX_AGE_SECONDS}`);
    // Caching is an optimization; a failed write must not fail verification.
    await cache.put(cacheKey, new Response(body, { headers })).catch(() => undefined);
  }

  return parseJwks(body);
}

function defaultCache(): Cache | null {
  return (globalThis as unknown as { caches?: CacheStorage }).caches?.default ?? null;
}

function parseJwks(body: string): (JsonWebKey & { kid?: string })[] {
  const parsed = JSON.parse(body) as JwksResponse;
  return parsed.keys ?? [];
}
function decodeJson(value: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
