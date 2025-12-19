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
  // Handle Date objects (including those that lost prototype after JSON serialization)
  if (value instanceof Date) {
    return value;
  }
  // Handle objects that might be serialized Date objects or BigQuery date objects
  if (typeof value === "object" && value !== null) {
    // Check if it's a Date-like object (has getTime method)
    if ("getTime" in value && typeof value.getTime === "function") {
      try {
        const timeValue = value.getTime();
        if (typeof timeValue === "number" && !Number.isNaN(timeValue)) {
          return new Date(timeValue);
        }
      } catch {
        // Fall through to other checks
      }
    }
    // Check if it has ISO date string properties (common in serialized Date objects)
    if ("toISOString" in value && typeof value.toISOString === "function") {
      try {
        const isoString = value.toISOString();
        const parsed = Date.parse(isoString);
        if (!Number.isNaN(parsed)) {
          return new Date(parsed);
        }
      } catch {
        // Fall through to other checks
      }
    }
    // Check if it has a value property (BigQuery date wrapper)
    if ("value" in value) {
      const coerced = coerceObjectDate(value);
      if (coerced) return coerced;
    }
    // Check for common date string properties in objects
    const dateStringKeys = ["date", "dateValue", "value", "timestamp"];
    for (const key of dateStringKeys) {
      if (key in value && typeof value[key] === "string") {
        const parsed = Date.parse(value[key] as string);
        if (!Number.isNaN(parsed)) {
          return new Date(parsed);
        }
      }
    }
    // Check if object has date component properties (year, month, day)
    if ("year" in value && "month" in value && "day" in value) {
      try {
        const year = Number(value.year);
        const month = Number(value.month) - 1; // JavaScript months are 0-indexed
        const day = Number(value.day);
        if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
          return new Date(year, month, day);
        }
      } catch {
        // Fall through
      }
    }
    // Check all string values in the object for date-like patterns
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === "string" && val.length >= 8) {
        // Check if it looks like a date string (YYYY-MM-DD or similar)
        const datePattern = /^\d{4}-\d{2}-\d{2}/;
        if (datePattern.test(val)) {
          const parsed = Date.parse(val);
          if (!Number.isNaN(parsed)) {
            return new Date(parsed);
          }
        }
      }
    }
    // Check if it's a plain object with date-like string properties
    if ("toString" in value) {
      const str = String(value.toString());
      if (str && str !== "[object Object]") {
        const parsed = Date.parse(str);
        if (!Number.isNaN(parsed)) {
          return new Date(parsed);
        }
      }
    }
    // Try coerceObjectDate for other object patterns
    return coerceObjectDate(value);
  }
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
  return null;
};

export const formatDate = (value?: string | number | Date | Record<string, unknown> | null) => {
  const date = coerceDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return DATE_FORMATTER.format(date);
};

/**
 * Formats a date as "DD MMM YYYY DDD" (e.g., "18 Dec 2025 Thu")
 * Uses Asia/Karachi timezone
 */
export const formatDateWithDay = (value?: string | number | Date | Record<string, unknown> | null): string => {
  const date = coerceDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  
  const dayFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
    timeZone: "Asia/Karachi",
  });
  
  return dayFormatter.format(date);
};

/**
 * Converts a date value to an ISO date string (YYYY-MM-DD) for API responses.
 * Handles Date objects, date-like objects, strings, numbers, and BigQueryDate objects.
 * Returns null if the value cannot be converted to a valid date.
 */
export const convertDateToString = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  // Handle BigQueryDate objects specifically (they have a .value property)
  // Check for BigQueryDate by checking constructor name or value property
  if (typeof value === "object" && value !== null) {
    // Check if it's a BigQueryDate object (has constructor name 'BigQueryDate' or has .value property)
    const hasValueProperty = "value" in value;
    const constructorName = (value as any)?.constructor?.name;
    const isBigQueryDate = constructorName === "BigQueryDate" || hasValueProperty;
    
    if (isBigQueryDate && hasValueProperty) {
      try {
        // Try to access .value property - BigQueryDate has it as a property
        const bigQueryValue = (value as any).value;
        
        if (typeof bigQueryValue === "string") {
          // BigQueryDate.value is already a string in YYYY-MM-DD format
          const trimmed = bigQueryValue.trim();
          if (trimmed) {
            // Extract date part if it's a datetime string
            return trimmed.split('T')[0];
          }
        }
        // If value is not a string, try to convert it recursively
        if (bigQueryValue !== null && bigQueryValue !== undefined) {
          return convertDateToString(bigQueryValue);
        }
      } catch (error) {
        // If accessing .value fails, fall through to other conversion methods
        console.warn('[DATE_CONVERSION] Failed to access BigQueryDate.value:', error);
      }
      
      // Fallback: try to convert the object itself
      return null;
    }
  }

  // If it's already a string, handle various formats
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    
    // Check if it's already in YYYY-MM-DD format
    const datePattern = /^\d{4}-\d{2}-\d{2}/;
    if (datePattern.test(trimmed)) {
      return trimmed.split('T')[0]; // Extract date part if it's a datetime string
    }
    
    // Handle MM/DD/YYYY format (e.g., "12/16/2025")
    const mmddyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const mmddyyyyMatch = trimmed.match(mmddyyyyPattern);
    if (mmddyyyyMatch) {
      const [, month, day, year] = mmddyyyyMatch;
      // Create date in YYYY-MM-DD format
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      // Validate the date
      const parsed = Date.parse(dateStr);
      if (!Number.isNaN(parsed)) {
        return dateStr;
      }
    }
    
    // Try to parse and convert to YYYY-MM-DD (handles various formats)
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      return date.toISOString().split('T')[0];
    }
    return null;
  }

  // Use coerceDate to convert to Date object, then format as YYYY-MM-DD
  const date = coerceDate(value as any);
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  // Convert to YYYY-MM-DD format
  return date.toISOString().split('T')[0];
};

export const formatCurrency = (value?: number | null) => {
  if (!value) return "—";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
};

