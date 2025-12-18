import { NextResponse } from "next/server";
import { fetchOPDByEmployee, fetchOPDBalance } from "@/lib/opd";

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

    const [benefits, balance] = await Promise.all([
      fetchOPDByEmployee(employeeIdNum),
      fetchOPDBalance(employeeIdNum),
    ]);

    return NextResponse.json({
      benefits,
      balance,
    });
  } catch (error) {
    console.error("[OPD_EMPLOYEE_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch OPD data for employee" }, { status: 500 });
  }
}

