import { NextResponse } from "next/server";
import { fetchIncrements, lookupEmployeeId, lookupPreviousSalary } from "@/lib/pay-template";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    
    if (!month) {
      return NextResponse.json({ message: "Month parameter is required" }, { status: 400 });
    }
    
    const increments = await fetchIncrements(month);
    
    // Enrich with lookup status and fill missing Employee IDs and Previous Salaries
    const enriched = await Promise.all(
      increments.map(async (increment) => {
        let employeeId = increment.Employee_ID;
        let employeeIdLookup = false;
        let previousSalaryLookup = false;
        
        // Lookup Employee ID if missing
        if (!employeeId && increment.Employee_Name) {
          const lookedUpId = await lookupEmployeeId(increment.Employee_Name);
          if (lookedUpId) {
            employeeId = lookedUpId;
            employeeIdLookup = true;
          }
        }
        
        // Lookup Previous Salary if missing and we have Employee ID
        if (!increment.Previous_Salary && employeeId && increment.Currency) {
          const previousSalary = await lookupPreviousSalary(employeeId, increment.Currency);
          if (previousSalary != null) {
            return {
              ...increment,
              Employee_ID: employeeId,
              Employee_ID_Lookup: employeeIdLookup,
              Previous_Salary: previousSalary,
              Previous_Salary_Lookup: true,
            };
          }
        }
        
        return {
          ...increment,
          Employee_ID: employeeId,
          Employee_ID_Lookup: employeeIdLookup,
          Previous_Salary_Lookup: previousSalaryLookup,
        };
      })
    );
    
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[PAY_TEMPLATE_INCREMENTS_ERROR]", error);
    return NextResponse.json({ message: "Failed to fetch increments" }, { status: 500 });
  }
}
