import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { fetchEmployees } from '@/lib/employees';
import type { EmploymentStatus } from '@/types/employee';
import { recordsToCSV } from '@/lib/csv';

const DATE_FIELDS = ["Created_At", "Updated_At"];

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const EXCEL_MIN = 20000;
const EXCEL_MAX = 80000;
const MS_LENGTH = 13;

const normaliseEpoch = (value: number) => {
  const text = String(Math.trunc(value));
  if (text.length > MS_LENGTH) {
    const slice = text.slice(0, MS_LENGTH);
    return Number(slice);
  }
  if (text.length < MS_LENGTH) {
    return Number(text.padEnd(MS_LENGTH, "0"));
  }
  return Number(text);
};

const toIsoDate = (value: unknown) => {
  const coerce = (input: unknown): Date | null => {
    if (input === null || input === undefined || input === "") return null;
    if (input instanceof Date) return input;
    if (typeof input === "object") {
      if ("value" in (input as Record<string, unknown>)) {
        return coerce((input as Record<string, unknown>).value);
      }
      return null;
    }
    if (typeof input === "number" && !Number.isNaN(input)) {
      if (input >= EXCEL_MIN && input <= EXCEL_MAX) {
        const millis = Math.trunc(input) * 24 * 60 * 60 * 1000;
        return new Date(EXCEL_EPOCH + millis);
      }
      const normalised = normaliseEpoch(input);
      return new Date(normalised);
    }
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return null;
      if (/^\d+$/.test(trimmed)) {
        const numeric = Number(trimmed);
        if (!Number.isNaN(numeric)) {
          return coerce(numeric);
        }
      }
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed);
      }
    }
    return null;
  };
  const date = coerce(value);
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
};

const prepareRecordForExport = (record: Record<string, unknown>) => {
  const result: Record<string, unknown> = { ...record };
  DATE_FIELDS.forEach((field) => {
    if (field in result && result[field] !== null && result[field] !== undefined && result[field] !== "") {
      const iso = toIsoDate(result[field]);
      result[field] = iso || result[field];
    }
  });
  return result;
};

const columnMapPath = path.join(process.cwd(), "..", "EmployeeData", "employee_directory_column_map.json");
let columnMap: Record<string, string> = {};
try {
  const file = fs.readFileSync(columnMapPath, "utf8");
  columnMap = JSON.parse(file);
} catch (error) {
  console.warn("[EMPLOYEE_EXPORT] Failed to read column map", error);
}

const renameColumnsForExport = (record: Record<string, unknown>) => {
  const renamed: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    const original = columnMap[key];
    if (original) {
      renamed[original] = value;
    } else {
      renamed[key] = value;
    }
  });
  return renamed;
};

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as EmploymentStatus | null;
    const department = searchParams.get('department');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const format = searchParams.get('format');
    const isDownload = format === 'csv';

    const employees = await fetchEmployees({
      status: status ?? undefined,
      department: department || undefined,
      search: search || undefined,
      limit: limit ? Number(limit) : isDownload ? 10000 : 50,
      offset: offset ? Number(offset) : 0,
    });

    if (isDownload) {
      const prepared = employees.map((record) =>
        renameColumnsForExport(prepareRecordForExport(record as unknown as Record<string, unknown>)),
      );
      const csv = recordsToCSV(prepared);
      const suffix = status ? status.replace(/\s+/g, '-').toLowerCase() : 'all';
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="directory-${suffix}.csv"`,
        },
      });
    }

    return NextResponse.json(employees);
  } catch (error) {
    console.error('[EMPLOYEE_LIST_ERROR]', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      url: request.url,
      searchParams: Object.fromEntries(new URL(request.url).searchParams)
    });
    return NextResponse.json({ 
      message: 'Failed to fetch employees',
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

