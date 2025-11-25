import { NextResponse } from "next/server";
import { upsertOffboardingRecord, clearOffboardingRecord } from "@/lib/offboarding";
import { updateEmploymentEndDate } from "@/lib/employees";

interface RouteParams {
  params: Promise<{ employeeId: string }>;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    const body = await request.json();
    const employmentEndDate = body?.Employment_End_Date;
    if (!employmentEndDate) {
      return NextResponse.json({ message: "Employment_End_Date is required" }, { status: 400 });
    }
    const note = body?.Note ?? null;
    const scheduledBy = body?.Scheduled_By ?? "dashboard@vyro.ai";
    const record = await upsertOffboardingRecord({
      employeeId,
      employmentEndDate,
      note,
      status: "scheduled",
      user: scheduledBy,
    });
    await updateEmploymentEndDate(employeeId, employmentEndDate);
    return NextResponse.json(record);
  } catch (error) {
    console.error("[OFFBOARDING_SCHEDULE_ERROR]", error);
    return NextResponse.json({ message: "Failed to schedule offboarding" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { employeeId } = await params;
    await clearOffboardingRecord(employeeId);
    await updateEmploymentEndDate(employeeId, null);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[OFFBOARDING_CANCEL_ERROR]", error);
    return NextResponse.json({ message: "Failed to cancel offboarding" }, { status: 500 });
  }
}


