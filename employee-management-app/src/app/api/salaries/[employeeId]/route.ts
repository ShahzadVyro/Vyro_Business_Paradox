import { NextResponse } from "next/server";
import { fetchLatestSalary } from "@/lib/payroll";

interface RouteParams {
  params: Promise<{ employeeId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    const record = await fetchLatestSalary(employeeId);
    if (!record) {
      return NextResponse.json({ message: "No salary record found" }, { status: 404 });
    }
    return NextResponse.json(record);
  } catch (error) {
    console.error("[SALARY_FETCH_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch salary data" }, { status: 500 });
  }
}


