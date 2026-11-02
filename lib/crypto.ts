import crypto from "crypto";

// 32-byte secret key derived from environment or fallback key for development
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "agency-super-secret-key-32-bytes!";

if (!process.env.ENCRYPTION_SECRET) {
  console.warn("[CRYPTO] ENCRYPTION_SECRET is not set. Vault secrets use a public default key — set ENCRYPTION_SECRET in .env.");
}
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns formatted ciphertext: "ENC(v1:AESGCM:<iv>:<authTag>:<encryptedPayload>)"
 */
export function encrypt(text: string): string {
  if (!text) return "";
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `ENC(v1:AESGCM:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted})`;
  } catch (error) {
    console.error("Encryption error:", error);
    return text;
  }
}

/**
 * Decrypt a ciphertext string formatted with ENC(v1:AESGCM:...)
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("ENC(v1:AESGCM:")) {
    // If it's not encrypted or legacy plaintext
    return cipherText;
  }

  try {
    const inner = cipherText.replace(/^ENC\(v1:AESGCM:/, "").replace(/\)$/, "");
    const [ivHex, authTagHex, encryptedData] = inner.split(":");

    if (!ivHex || !authTagHex || !encryptedData) {
      return cipherText;
    }

    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return "[Decryption Error]";
  }
}
