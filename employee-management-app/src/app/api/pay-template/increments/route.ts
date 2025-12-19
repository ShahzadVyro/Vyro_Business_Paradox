import { NextResponse } from "next/server";
import { fetchIncrements, lookupEmployeeId, lookupPreviousSalary, addIncrement, getLatestCurrency } from "@/lib/pay-template";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const employeeId = searchParams.get("employeeId");
    const currency = searchParams.get("currency");
    
    // Handle previous salary lookup request
    if (employeeId) {
      const previousSalary = currency 
        ? await lookupPreviousSalary(employeeId, currency)
        : null;
      const latestCurrency = await getLatestCurrency(employeeId);
      
      return NextResponse.json({
        previousSalary,
        currency: latestCurrency || currency || "PKR",
      });
    }
    
    // Regular increments fetch
    if (!month) {
      return NextResponse.json({ message: "Month parameter is required" }, { status: 400 });
    }
    
    const increments = await fetchIncrements(month);
    
    // Enrich with lookup status and fill missing Employee IDs and Previous Salaries
    const enriched = await Promise.all(
      increments.map(async (increment) => {
        let empId = increment.Employee_ID;
        let employeeIdLookup = false;
        let previousSalaryLookup = false;
        
        // Lookup Employee ID if missing
        if (!empId && increment.Employee_Name) {
          const lookedUpId = await lookupEmployeeId(increment.Employee_Name);
          if (lookedUpId) {
            empId = lookedUpId;
            employeeIdLookup = true;
          }
        }
        
        // Lookup Previous Salary if missing and we have Employee ID
        if (!increment.Previous_Salary && empId && increment.Currency) {
          const previousSalary = await lookupPreviousSalary(empId, increment.Currency);
          if (previousSalary != null) {
            return {
              ...increment,
              Employee_ID: empId,
              Employee_ID_Lookup: employeeIdLookup,
              Previous_Salary: previousSalary,
              Previous_Salary_Lookup: true,
            };
          }
        }
        
        return {
          ...increment,
          Employee_ID: empId,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      employeeId,
      effectiveDate,
      updatedSalary,
      currency,
      previousSalary,
      designation,
      department,
      comments,
      remarks,
    } = body;
    
    if (!employeeId || !effectiveDate || updatedSalary === undefined || !currency) {
      return NextResponse.json(
        { message: "Missing required fields: employeeId, effectiveDate, updatedSalary, currency" },
        { status: 400 }
      );
    }
    
    await addIncrement(
      String(employeeId),
      effectiveDate,
      Number(updatedSalary),
      currency,
      previousSalary != null ? Number(previousSalary) : null,
      designation || null,
      department || null,
      comments || null,
      remarks || null
    );
    
    return NextResponse.json({ success: true, message: "Increment added successfully" });
  } catch (error) {
    console.error("[PAY_TEMPLATE_INCREMENTS_POST_ERROR]", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to add increment" },
      { status: 500 }
    );
  }
}
