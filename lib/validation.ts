// Shared request validation helpers

/** Max size of a stored logo data URL (~300 KB of base64). Logos are resized client-side to 256px. */
const MAX_LOGO_LENGTH = 400_000;

/**
 * Validates a client logo value.
 * - undefined → field not sent (keep existing)
 * - "" / null → remove logo
 * - data:image/(png|jpeg|webp);base64,... → new logo
 * SVG is rejected on purpose: it can carry scripts.
 */
export function validateLogo(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "Logo must be an image.";
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    return "Logo must be a PNG, JPEG or WebP image.";
  }
  if (value.length > MAX_LOGO_LENGTH) return "Logo image is too large (max ~300 KB).";
  return null;
}
