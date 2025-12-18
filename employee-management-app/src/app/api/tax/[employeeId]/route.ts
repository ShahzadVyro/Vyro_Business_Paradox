import { NextResponse } from "next/server";
import { fetchTaxByEmployee } from "@/lib/tax";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ employeeId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    const employeeIdNum = parseInt(employeeId, 10);
    
    if (isNaN(employeeIdNum)) {
      return NextResponse.json({ message: "Invalid employee ID" }, { status: 400 });
    }

    const taxRecords = await fetchTaxByEmployee(employeeIdNum);

    return NextResponse.json({
      tax: taxRecords,
    });
  } catch (error) {
    console.error("[TAX_EMPLOYEE_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch tax data for employee" }, { status: 500 });
  }
}

