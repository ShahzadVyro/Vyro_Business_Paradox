import { NextResponse } from "next/server";
import { fetchNewHires, lookupEmployeeId } from "@/lib/pay-template";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    
    if (!month) {
      return NextResponse.json({ message: "Month parameter is required" }, { status: 400 });
    }
    
    const newHires = await fetchNewHires(month);
    
    // Enrich with lookup status and fill missing Employee IDs
    const enriched = await Promise.all(
      newHires.map(async (hire) => {
        if (!hire.Employee_ID && hire.Employee_Name) {
          const employeeId = await lookupEmployeeId(hire.Employee_Name, hire.Official_Email || undefined);
          if (employeeId) {
            return {
              ...hire,
              Employee_ID: employeeId,
              Employee_ID_Lookup: true,
            };
          }
        }
        return hire;
      })
    );
    
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[PAY_TEMPLATE_NEW_HIRES_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch new hires" }, { status: 500 });
  }
}
