import fs from "fs";
import path from "path";

type EnvMap = Record<string, string>;

let cachedFallbackEnv: EnvMap | null = null;

const FALLBACK_FILENAME = "Credentials/configurationEnvironmentVars.json";

const loadFallbackEnv = (): EnvMap => {
  if (cachedFallbackEnv) {
    return cachedFallbackEnv;
  }

  const projectRoot = process.cwd();
  const fallbackPath =
    process.env.VYRO_ENV_FILE ??
    path.resolve(projectRoot, "..", FALLBACK_FILENAME);

  const map: EnvMap = {};

  try {
    const raw = fs.readFileSync(fallbackPath, "utf-8");
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
        continue;
      }
      const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+?);?$/);
      if (!match) continue;
      const [, key, valueRaw] = match;
      let value = valueRaw.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else if (value.startsWith("[") && value.endsWith("]")) {
        try {
          const parsed = JSON.parse(value.replace(/'/g, '"'));
          if (Array.isArray(parsed)) {
            value = parsed.join(",");
          }
        } catch {
          // fall back to raw string
        }
      }

      map[key] = value;
    }
  } catch (error) {
    console.warn(
      `[ENV_FALLBACK] Unable to read ${fallbackPath}:`,
      error instanceof Error ? error.message : error
    );
  }

  cachedFallbackEnv = map;
  return map;
};

export const getEnv = (name: string): string | undefined => {
  if (process.env[name]) {
    return process.env[name];
  }
  const fallback = loadFallbackEnv();
  if (name in fallback) {
    return fallback[name];
  }
  return undefined;
};

export const getEnvArray = (name: string): string[] => {
  const raw = getEnv(name);
  if (!raw) return [];
  if (raw.trim().startsWith("[") && raw.trim().endsWith("]")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.map((entry) => String(entry).trim()).filter(Boolean);
      }
    } catch {
      // ignore and fall through
    }
  }
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [raw];
};

