import { NextResponse } from "next/server";
import { fetchLeavers, lookupEmployeeId } from "@/lib/pay-template";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    
    if (!month) {
      return NextResponse.json({ message: "Month parameter is required" }, { status: 400 });
    }
    
    const leavers = await fetchLeavers(month);
    
    // Enrich with lookup status and fill missing Employee IDs
    const enriched = await Promise.all(
      leavers.map(async (leaver) => {
        if (!leaver.Employee_ID && leaver.Employee_Name) {
          const employeeId = await lookupEmployeeId(leaver.Employee_Name);
          if (employeeId) {
            return {
              ...leaver,
              Employee_ID: employeeId,
              Employee_ID_Lookup: true,
            };
          }
        }
        return leaver;
      })
    );
    
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[PAY_TEMPLATE_LEAVERS_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch leavers" }, { status: 500 });
  }
}
