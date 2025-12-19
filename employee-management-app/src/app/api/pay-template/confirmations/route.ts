import { NextResponse } from "next/server";
import { fetchConfirmations, lookupEmployeeId, approveConfirmation } from "@/lib/pay-template";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    
    if (!month) {
      return NextResponse.json({ message: "Month parameter is required" }, { status: 400 });
    }
    
    const confirmations = await fetchConfirmations(month);
    
    // Enrich with lookup status and fill missing Employee IDs
    const enriched = await Promise.all(
      confirmations.map(async (confirmation) => {
        if (!confirmation.Employee_ID && confirmation.Employee_Name) {
          const employeeId = await lookupEmployeeId(confirmation.Employee_Name);
          if (employeeId) {
            return {
              ...confirmation,
              Employee_ID: employeeId,
              Employee_ID_Lookup: true,
            };
          }
        }
        return confirmation;
      })
    );
    
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[PAY_TEMPLATE_CONFIRMATIONS_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch confirmations" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, month, approvedBy } = body;
    
    if (!employeeId || !month) {
      return NextResponse.json(
        { message: "Missing required fields: employeeId, month" },
        { status: 400 }
      );
    }
    
    await approveConfirmation(
      String(employeeId),
      month,
      approvedBy || "System"
    );
    
    return NextResponse.json({ success: true, message: "Confirmation approved successfully" });
  } catch (error) {
    console.error("[PAY_TEMPLATE_CONFIRMATIONS_APPROVE_ERROR]", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to approve confirmation" },
      { status: 500 }
    );
  }
}
