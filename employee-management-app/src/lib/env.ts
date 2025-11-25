export const getEnv = (name: string): string | undefined => {
  return process.env[name];
};

export const getEnvArray = (name: string): string[] => {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

