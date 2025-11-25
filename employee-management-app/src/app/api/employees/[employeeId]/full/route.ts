import { NextResponse } from "next/server";
import { fetchEmployeeFull } from "@/lib/employees";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ employeeId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    const full = await fetchEmployeeFull(employeeId);

    if (!full.profile) {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json(full);
  } catch (error) {
    console.error("[EMPLOYEE_FULL_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch employee detail" }, { status: 500 });
  }
}

