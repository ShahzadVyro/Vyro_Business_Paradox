import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/bigquery";
import type { SalaryRecord } from "@/types/api/payroll";
import { convertDateToString } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;
const salaryTable = process.env.BQ_SALARY_TABLE ?? "Employee_Salaries";
const salariesTableRef = `\`${projectId}.${dataset}.${salaryTable}\``;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const currency = searchParams.get("currency");

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required" },
        { status: 400 }
      );
    }

    const bigquery = getBigQueryClient();
    const conditions: string[] = [`s.Employee_ID = @employeeId`];
    const params: Record<string, unknown> = {
      employeeId: parseInt(employeeId, 10),
    };

    if (currency) {
      conditions.push(`s.Currency = @currency`);
      params.currency = currency;
    }

    const query = `
      SELECT 
        s.*,
        e.Full_Name AS Employee_Name
      FROM ${salariesTableRef} s
      LEFT JOIN \`${projectId}.${dataset}.${process.env.BQ_TABLE ?? "Employees"}\` e 
        ON s.Employee_ID = e.Employee_ID
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.Payroll_Month DESC, s.Currency ASC
      LIMIT 50
    `;

    const [rows] = await bigquery.query({
      query,
      params,
    });

    const salaryHistory = (rows as SalaryRecord[]).map((row) => ({
      ...row,
      Employee_ID: row.Employee_ID !== null && row.Employee_ID !== undefined
        ? (typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID)
        : null,
      Payroll_Month: convertDateToString(row.Payroll_Month) ?? null,
      Created_At: 'Created_At' in row && row.Created_At ? convertDateToString(row.Created_At as unknown) ?? null : null,
      Updated_At: 'Updated_At' in row && row.Updated_At ? convertDateToString(row.Updated_At as unknown) ?? null : null,
    }));

    return NextResponse.json(salaryHistory);
  } catch (error) {
    console.error("[SALARY_HISTORY_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch salary history", details: String(error) },
      { status: 500 }
    );
  }
}
