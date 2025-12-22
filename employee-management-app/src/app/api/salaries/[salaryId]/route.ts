import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import { calculateGrossIncome } from "@/lib/payroll-calculations";

export const dynamic = "force-dynamic";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;
const salaryTable = process.env.BQ_SALARY_TABLE ?? "Employee_Salaries";
const salariesTableRef = `\`${projectId}.${dataset}.${salaryTable}\``;

// Valid fields that can be updated
const VALID_FIELDS = [
  "Performance_Bonus",
  "Paid_Overtime",
  "Reimbursements",
  "Other",
  "Unpaid_Leaves",
  "Deductions",
  "Payable_from_Last_Month",
  "Salary_Status",
  "PaySlip_Status",
  "Comments",
  "Internal_Comments",
  "Regular_Pay",
  "Prorated_Pay",
  "Gross_Income",
  "Net_Income",
  // PKR-specific fields
  "Prorated_Base_Pay",
  "Prorated_Medical_Allowance",
  "Prorated_Transport_Allowance",
  "Prorated_Inflation_Allowance",
  "Taxable_Income",
  "Tax_Deduction",
  "EOBI",
  "Loan_Deduction",
  "Recoveries",
];

interface UpdateSalaryRequest {
  [key: string]: string | number | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ salaryId: string }> }
) {
  try {
    const { salaryId } = await params;
    const body: UpdateSalaryRequest = await request.json();

    if (!salaryId) {
      return NextResponse.json(
        { error: "Salary ID is required" },
        { status: 400 }
      );
    }

    // Validate fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (VALID_FIELDS.includes(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const bigquery = getBigQueryClient();

    // First, get current salary record to recalculate Gross_Income if needed
    const getCurrentQuery = `
      SELECT 
        Prorated_Pay,
        Performance_Bonus,
        Paid_Overtime,
        Reimbursements,
        Other,
        Payable_from_Last_Month,
        Deductions,
        Gross_Income,
        Currency
      FROM ${salariesTableRef}
      WHERE Salary_ID = @salaryId
    `;

    const [currentRows] = await bigquery.query({
      query: getCurrentQuery,
      params: { salaryId: parseInt(salaryId, 10) },
    });

    if (currentRows.length === 0) {
      return NextResponse.json(
        { error: "Salary record not found" },
        { status: 404 }
      );
    }

    const current = currentRows[0] as any;

    // Recalculate Gross_Income if any component changed
    const needsGrossRecalc =
      "Performance_Bonus" in updates ||
      "Paid_Overtime" in updates ||
      "Reimbursements" in updates ||
      "Other" in updates ||
      "Payable_from_Last_Month" in updates ||
      "Prorated_Pay" in updates;

    if (needsGrossRecalc) {
      const proratedPay =
        (updates.Prorated_Pay as number) ?? current.Prorated_Pay ?? null;
      const performanceBonus =
        (updates.Performance_Bonus as number) ?? current.Performance_Bonus ?? null;
      const paidOvertime =
        (updates.Paid_Overtime as number) ?? current.Paid_Overtime ?? null;
      const reimbursements =
        (updates.Reimbursements as number) ?? current.Reimbursements ?? null;
      const other = (updates.Other as number) ?? current.Other ?? null;
      const payableFromLast =
        (updates.Payable_from_Last_Month as number) ??
        current.Payable_from_Last_Month ??
        null;

      const newGrossIncome = calculateGrossIncome(
        proratedPay,
        performanceBonus,
        paidOvertime,
        reimbursements,
        other,
        payableFromLast
      );

      updates.Gross_Income = newGrossIncome;
    }

    // Recalculate Net_Income if Gross_Income or Deductions changed
    const needsNetRecalc =
      "Gross_Income" in updates || "Deductions" in updates;

    if (needsNetRecalc) {
      const grossIncome =
        (updates.Gross_Income as number) ?? current.Gross_Income ?? 0;
      const deductions =
        (updates.Deductions as number) ?? current.Deductions ?? 0;
      updates.Net_Income = grossIncome - deductions;
    }

    // Build update query
    const setClauses: string[] = [];
    const updateParams: Record<string, unknown> = { salaryId: parseInt(salaryId, 10) };
    const updateTypes: Record<string, string> = {};

    for (const [key, value] of Object.entries(updates)) {
      const paramName = key.replace(/_/g, "");
      setClauses.push(`${key} = @${paramName}`);
      updateParams[paramName] = value;
      if (value === null) {
        // Determine type based on field name
        if (
          key.includes("Pay") ||
          key.includes("Bonus") ||
          key.includes("Overtime") ||
          key.includes("Reimbursements") ||
          key.includes("Other") ||
          key.includes("Income") ||
          key.includes("Deduction") ||
          key.includes("EOBI") ||
          key.includes("Loan") ||
          key.includes("Recoveries") ||
          key.includes("Leaves")
        ) {
          updateTypes[paramName] = "NUMERIC";
        } else if (
          key.includes("Status") ||
          key.includes("Comments")
        ) {
          updateTypes[paramName] = "STRING";
        }
      }
    }

    // Always update Updated_At
    setClauses.push("Updated_At = CURRENT_TIMESTAMP()");

    const updateQuery = `
      UPDATE ${salariesTableRef}
      SET ${setClauses.join(", ")}
      WHERE Salary_ID = @salaryId
    `;

    await bigquery.query({
      query: updateQuery,
      params: updateParams,
      ...(Object.keys(updateTypes).length > 0 && { types: updateTypes }),
    });

    return NextResponse.json({
      message: "Salary record updated successfully",
      updated: Object.keys(updates).length,
    });
  } catch (error) {
    console.error("[SALARY_UPDATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update salary record", details: String(error) },
      { status: 500 }
    );
  }
}
