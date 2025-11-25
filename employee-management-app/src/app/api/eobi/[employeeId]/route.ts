import { NextResponse } from "next/server";
import { fetchLatestEOBI } from "@/lib/payroll";

interface RouteParams {
  params: Promise<{ employeeId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    const record = await fetchLatestEOBI(employeeId);
    if (!record) {
      return NextResponse.json({ message: "No EOBI record found" }, { status: 404 });
    }
    return NextResponse.json(record);
  } catch (error) {
    console.error("[EOBI_FETCH_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch EOBI data" }, { status: 500 });
  }
}


