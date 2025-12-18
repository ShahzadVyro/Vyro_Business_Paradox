import { NextResponse } from "next/server";
import { fetchTaxCalculations, fetchTaxMonths } from "@/lib/tax";
import type { TaxFilters } from "@/types/tax";
import { recordsToCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const isDownload = format === "csv";

    const filters: TaxFilters = {
      month: searchParams.get("month") ?? undefined,
      employeeId: searchParams.get("employeeId") ? Number(searchParams.get("employeeId")) : undefined,
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    };

    const months = await fetchTaxMonths();
    const activeMonth = filters.month ?? months[0]?.value;
    const effectiveFilters: TaxFilters = {
      ...filters,
      month: activeMonth ?? undefined,
      limit: filters.limit ?? (isDownload ? 10000 : 50),
      offset: isDownload ? 0 : filters.offset ?? 0,
    };

    const result = await fetchTaxCalculations(effectiveFilters);

    if (isDownload) {
      const csv = recordsToCSV(result.rows as unknown as Record<string, unknown>[]);
      const filenameParts = [
        "tax-calculations",
        effectiveFilters.month ?? "all",
      ];
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameParts.join("-")}.csv"`,
        },
      });
    }

    return NextResponse.json({
      rows: result.rows,
      total: result.total,
      months,
      activeMonth,
    });
  } catch (error) {
    console.error("[TAX_LIST_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch tax calculations data" }, { status: 500 });
  }
}

