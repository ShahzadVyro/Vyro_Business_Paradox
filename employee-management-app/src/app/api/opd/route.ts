import { NextResponse } from "next/server";
import { fetchOPDBenefits, fetchOPDMonths } from "@/lib/opd";
import type { OPDFilters } from "@/types/opd";
import { recordsToCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const isDownload = format === "csv";

    const filters: OPDFilters = {
      month: searchParams.get("month") ?? undefined,
      employeeId: searchParams.get("employeeId") ? Number(searchParams.get("employeeId")) : undefined,
      currency: searchParams.get("currency") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    };

    const months = await fetchOPDMonths();
    const activeMonth = filters.month ?? months[0]?.value;
    const effectiveFilters: OPDFilters = {
      ...filters,
      month: activeMonth ?? undefined,
      limit: filters.limit ?? (isDownload ? 10000 : 50),
      offset: isDownload ? 0 : filters.offset ?? 0,
    };

    const result = await fetchOPDBenefits(effectiveFilters);

    if (isDownload) {
      const csv = recordsToCSV(result.rows as unknown as Record<string, unknown>[]);
      const filenameParts = [
        "opd-benefits",
        effectiveFilters.currency?.toLowerCase() ?? "all",
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
    console.error("[OPD_LIST_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch OPD benefits data" }, { status: 500 });
  }
}

