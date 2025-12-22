import { NextResponse } from "next/server";
import { fetchEobiMonths, fetchEobiRecords } from "@/lib/payroll";
import type { EobiFilters } from "@/types/payroll";
import { recordsToCSV } from "@/lib/csv";

const PORTAL_HEADERS = [
  "EMP_AREA_CODE",
  "EMP_REG_SERIAL_NO",
  "EMP_SUB_AREA_CODE",
  "EMP_SUB_SERIAL_NO",
  "NAME",
  "EOBI_NO",
  "CNIC",
  "NIC",
  "DOB",
  "DOJ",
  "DOE",
  "NO_OF_DAYS_WORKED",
  "From_Date",
  "To_Date",
];

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const EXCEL_MIN = 20000;
const EXCEL_MAX = 80000;

const toIsoDate = (value: unknown): string => {
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
      return new Date(input);
    }
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return null;
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

const mapPortalRow = (row: Record<string, unknown>) => ({
  EMP_AREA_CODE: "FAA",
  EMP_REG_SERIAL_NO: "4320",
  EMP_SUB_AREA_CODE: " ",
  EMP_SUB_SERIAL_NO: "0",
  NAME: row.NAME ?? "",
  EOBI_NO: row.EOBI_NO ?? "",
  CNIC: row.CNIC ?? "",
  NIC: row.NIC ?? "",
  DOB: toIsoDate(row.DOB),
  DOJ: toIsoDate(row.DOJ),
  DOE: toIsoDate(row.DOE),
  NO_OF_DAYS_WORKED: row.NO_OF_DAYS_WORKED ?? "",
  From_Date: toIsoDate(row.From_Date),
  To_Date: toIsoDate(row.To_Date),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const isDownload = format === "csv";
    const view = searchParams.get("view") ?? undefined;

    const filters: EobiFilters = {
      month: searchParams.get("month") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    };

    const months = await fetchEobiMonths();
    const activeMonth = filters.month ?? months[0]?.value;

    const effectiveFilters: EobiFilters = {
      ...filters,
      month: activeMonth ?? undefined,
      limit: filters.limit ?? (isDownload ? 10000 : 50),
      offset: isDownload ? 0 : filters.offset ?? 0,
    };

    const result = await fetchEobiRecords(effectiveFilters);

    if (isDownload) {
      const rows: Record<string, unknown>[] =
        view === "portal"
          ? result.rows.map((row) => mapPortalRow(row as unknown as Record<string, unknown>))
          : (result.rows as unknown as Record<string, unknown>[]);
      const headerOrder = view === "portal" ? PORTAL_HEADERS : undefined;
      const csv = recordsToCSV(rows, headerOrder);
      const filename = view === "portal" ? `eobi-portal-${effectiveFilters.month ?? "all"}.csv` : `eobi-${effectiveFilters.month ?? "all"}.csv`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      ...result,
      months,
      activeMonth,
    });
  } catch (error) {
    console.error("[EOBI_LIST_ERROR]", {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      url: request.url,
      searchParams: Object.fromEntries(new URL(request.url).searchParams)
    });
    return NextResponse.json({ 
      message: "Failed to fetch EOBI data",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}


