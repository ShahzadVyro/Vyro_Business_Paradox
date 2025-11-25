const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Karachi",
});

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const EXCEL_MIN = 20000;
const EXCEL_MAX = 80000;

const isDigits = (raw: string) => /^[0-9]+$/.test(raw);

const fromEpochDigits = (digits: string) => {
  const targetLength = 13; // milliseconds
  if (digits.length <= targetLength) {
    return new Date(Number(digits));
  }
  const bigValue = BigInt(digits);
  const divisor = BigInt(10) ** BigInt(digits.length - targetLength);
  const millis = bigValue / divisor;
  return new Date(Number(millis));
};

const isLikelyExcelSerial = (value: number) => value >= EXCEL_MIN && value <= EXCEL_MAX;

const fromExcelSerial = (value: number) => {
  const serial = Math.trunc(value);
  const millis = serial * 24 * 60 * 60 * 1000;
  return new Date(EXCEL_EPOCH + millis);
};

const coerceObjectDate = (value: Record<string, unknown>) => {
  if ("value" in value && typeof value.value === "string") {
    const parsed = Date.parse(value.value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  if ("value" in value && typeof value.value === "number") {
    const numeric = Number(value.value);
    if (!Number.isNaN(numeric)) {
      if (isLikelyExcelSerial(numeric)) {
        return fromExcelSerial(numeric);
      }
      return new Date(numeric);
    }
  }
  return null;
};

const coerceDate = (value?: string | number | Date | Record<string, unknown> | null) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (value instanceof Date) return value;
  if (typeof value === "number" && !Number.isNaN(value)) {
    if (isLikelyExcelSerial(value)) {
      return fromExcelSerial(value);
    }
    const text = String(Math.trunc(value));
    return fromEpochDigits(text.length >= 13 ? text : `${text}`);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isDigits(trimmed)) {
      const numeric = Number(trimmed);
      if (isLikelyExcelSerial(numeric)) {
        return fromExcelSerial(numeric);
      }
      return fromEpochDigits(trimmed);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  if (typeof value === "object") {
    return coerceObjectDate(value);
  }
  return null;
};

export const formatDate = (value?: string | number | null) => {
  const date = coerceDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return DATE_FORMATTER.format(date);
};

export const formatCurrency = (value?: number | null) => {
  if (!value) return "—";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
};

