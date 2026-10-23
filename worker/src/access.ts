/**
 * Cloudflare Access JWT verification (`design-plans/backend-sync.md` §5).
 *
 * A Worker with Static Assets never receives `ctx.access`, so the platform hands us no
 * verified identity: the `Cf-Access-Jwt-Assertion` header must be validated here
 * (signature against the team JWKS, plus `aud` and `exp`) or an unauthenticated caller
 * could reach `/api/*` directly. The JWKS is fetched once and cached with
 * `caches.default`, so the common path costs no subrequest.
 */

const JWKS_PATH = '/cdn-cgi/access/certs';
const JWKS_MAX_AGE_SECONDS = 3600;
const CLOCK_SKEW_SECONDS = 30;
const ALLOWED_ALGORITHM = 'RS256';

export interface AccessEnv {
  CF_ACCESS_TEAM: string;
  CF_ACCESS_AUD: string;
}

interface AccessClaims {
  aud?: string | string[];
  exp?: number;
}

interface JwksResponse {
  keys?: (JsonWebKey & { kid?: string })[];
}

export async function verifyAccessJwt(request: Request, env: AccessEnv): Promise<boolean> {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  const header = decodeJson(headerPart) as { alg?: string; kid?: string } | null;
  const claims = decodeJson(payloadPart) as AccessClaims | null;
  if (!header || !claims) return false;
  if (header.alg !== ALLOWED_ALGORITHM) return false;
  if (!hasLiveSession(claims, env)) return false;

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

function hasLiveSession(claims: AccessClaims, env: AccessEnv): boolean {
  if (typeof claims.exp !== 'number') return false;
  if (claims.exp * 1000 + CLOCK_SKEW_SECONDS * 1000 <= Date.now()) return false;

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
