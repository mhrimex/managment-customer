/** The saved look lives in the existing app_meta table, so all users and devices share it. */
import { Appearance, DEFAULT_APPEARANCE, normalizeAppearance } from "@/lib/appearance";
import { dbAvailable, query } from "@/lib/db";

const KEY = "appearance";
const memory = global as unknown as { _appearance?: Appearance };

export async function getAppearance(): Promise<Appearance> {
  if (await dbAvailable()) {
    const rows = await query<{ value: string | null }>("SELECT value FROM app_meta WHERE [key] = @key", { key: KEY });
    if (!rows.length || !rows[0].value) return DEFAULT_APPEARANCE;
    try {
      return normalizeAppearance(JSON.parse(rows[0].value));
    } catch {
      return DEFAULT_APPEARANCE;
    }
  }
  return memory._appearance || DEFAULT_APPEARANCE;
}

export async function saveAppearance(input: unknown): Promise<Appearance> {
  const appearance = normalizeAppearance(input);
  if (await dbAvailable()) {
    await query(
      `UPDATE app_meta SET value = @value, updated_at = SYSUTCDATETIME() WHERE [key] = @key;
       IF @@ROWCOUNT = 0 INSERT INTO app_meta ([key], value) VALUES (@key, @value);`,
      { key: KEY, value: JSON.stringify(appearance) }
    );
  } else {
    memory._appearance = appearance;
  }
  return appearance;
}
