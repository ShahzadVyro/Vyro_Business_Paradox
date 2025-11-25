import { NextResponse } from "next/server";
import { fetchSalaries, fetchSalaryMonths } from "@/lib/payroll";
import type { SalaryFilters } from "@/types/payroll";
import { recordsToCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const isDownload = format === "csv";

    const filters: SalaryFilters = {
      month: searchParams.get("month") ?? undefined,
      currency: searchParams.get("currency") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    };

    const months = await fetchSalaryMonths();
    const activeMonth = filters.month ?? months[0]?.value;
    const effectiveFilters: SalaryFilters = {
      ...filters,
      month: activeMonth ?? undefined,
      limit: filters.limit ?? (isDownload ? 10000 : 50),
      offset: isDownload ? 0 : filters.offset ?? 0,
    };

    const result = await fetchSalaries(effectiveFilters);

    if (isDownload) {
      const csv = recordsToCSV(result.rows as unknown as Record<string, unknown>[]);
      const filenameParts = [
        "salaries",
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
      ...result,
      months,
      activeMonth,
    });
  } catch (error) {
    console.error("[SALARY_LIST_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch salary data" }, { status: 500 });
  }
}


