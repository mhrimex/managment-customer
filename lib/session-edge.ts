// Edge-runtime session verification (used by middleware).
// Mirrors createSessionToken() in lib/auth.ts, using Web Crypto instead of Node's crypto.

export const AUTH_COOKIE_NAME = "omniops_session";

const DEV_FALLBACK_SECRET = "omniops-auth-jwt-secret-key-64-bytes-min-sample!";

export function getAuthSecret(): string {
  return process.env.AUTH_SECRET || DEV_FALLBACK_SECRET;
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let cachedKey: { secret: string; key: CryptoKey } | null = null;

async function getKey(secret: string): Promise<CryptoKey> {
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  cachedKey = { secret, key };
  return key;
}

export interface EdgeSession {
  id: string;
  name: string;
  email: string;
  role: string;
  must_change_password: boolean;
}

/** Returns the session payload if the token's HMAC signature is valid and it has not expired. */
export async function verifySessionTokenEdge(token: string | undefined): Promise<EdgeSession | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [encodedPayload, signature] = parts;

  try {
    const key = await getKey(getAuthSecret());
    // crypto.subtle.verify does a constant-time comparison
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature) as BufferSource,
      new TextEncoder().encode(encodedPayload)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload)));
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return { id: payload.id, name: payload.name, email: payload.email, role: payload.role, must_change_password: payload.must_change_password === true };
  } catch {
    return null;
  }
}
