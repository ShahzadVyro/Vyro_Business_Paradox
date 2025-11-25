const sanitize = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const escapeCell = (value: string): string => {
  const needsWrapping = /[",\n]/.test(value);
  const cleaned = value.replace(/"/g, '""');
  return needsWrapping ? `"${cleaned}"` : cleaned;
};

export const recordsToCSV = (rows: Record<string, unknown>[], headerOrder?: string[]): string => {
  if (!rows || rows.length === 0) {
    return "";
  }

  const headers =
    headerOrder && headerOrder.length > 0
      ? headerOrder
      : Array.from(
          rows.reduce((set, row) => {
            Object.keys(row ?? {}).forEach((key) => set.add(key));
            return set;
          }, new Set<string>()),
        );

  const headerLine = headers.map((header) => escapeCell(header)).join(",");
  const lines = rows.map((row) =>
    headers.map((header) => escapeCell(sanitize((row ?? {})[header]))).join(","),
  );

  return [headerLine, ...lines].join("\n");
};


