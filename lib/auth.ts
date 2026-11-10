import crypto from "crypto";
import { cookies } from "next/headers";
import { SessionUser, User } from "@/types";
import { AUTH_COOKIE_NAME, getAuthSecret } from "@/lib/session-edge";

const AUTH_SECRET = getAuthSecret();

if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  console.warn("[AUTH] AUTH_SECRET is not set. Sessions are signed with a public development key — set AUTH_SECRET in .env.");
}

// =====================================================================
// Password Hashing (PBKDF2 with random salt)
// =====================================================================
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  // Handle mock placeholder hashes for pre-seeded users
  if (storedHash.includes("admin_hash_placeholder") && password === "Admin123!") return true;
  if (storedHash.includes("support_hash_placeholder") && password === "Support123!") return true;

  try {
    const [salt, originalHash] = storedHash.split(":");
    if (!salt || !originalHash) return false;
    const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(originalHash));
  } catch {
    return false;
  }
}

/** The passwords of the two default staff accounts (schema.sql). Signing in with one forces a change. */
export const DEFAULT_PASSWORDS = ["Admin123!", "Support123!"];

/** Rules for a new staff password. Returns the problem to show, or null when it is fine. */
export function newPasswordProblem(password: string, current?: string): string | null {
  if (password.length < 8) return "The new password must be at least 8 characters long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "The new password needs at least one letter and one number.";
  if (DEFAULT_PASSWORDS.some((d) => d.toLowerCase() === password.toLowerCase())) return "Choose a password that is not one of the default passwords.";
  if (current !== undefined && password === current) return "The new password must be different from the current one.";
  return null;
}

// =====================================================================
// Session Token (HMAC-SHA256 Signed JSON Token)
// =====================================================================
export function createSessionToken(user: SessionUser): string {
  const payload = {
    ...user,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    if (Date.now() > payload.exp) return null; // Expired
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      must_change_password: payload.must_change_password === true,
    };
  } catch {
    return null;
  }
}

// Read current user session from cookies
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export { AUTH_COOKIE_NAME };
