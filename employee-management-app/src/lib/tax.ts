import "server-only";
import type { TaxCalculationRecord, TaxFilters, TaxListResponse } from "@/types/tax";
import type { MonthOption } from "@/types/payroll";
import { getBigQueryClient } from "./bigquery";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;
const taxTable = process.env.BQ_TAX_TABLE ?? "Employee_Tax_Calculations";
const employeeTable = process.env.BQ_TABLE ?? "Employees";

if (!projectId || !dataset) {
  throw new Error("Missing BigQuery configuration for Tax tables");
}

const taxRef = `\`${projectId}.${dataset}.${taxTable}\``;
const employeeRef = `\`${projectId}.${dataset}.${employeeTable}\``;

const normalizeSearch = (value?: string | null) => (value ? `%${value.toLowerCase()}%` : undefined);

export async function fetchTaxMonths(): Promise<MonthOption[]> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT DISTINCT
      FORMAT_DATE('%Y-%m', Payroll_Month) AS value,
      FORMAT_DATE('%b %Y', Payroll_Month) AS label
    FROM ${taxRef}
    WHERE Payroll_Month IS NOT NULL
    ORDER BY value DESC
  `;
  const [rows] = await bigquery.query({ query });
  return rows as MonthOption[];
}

export async function fetchTaxCalculations(filters: TaxFilters): Promise<{ rows: TaxCalculationRecord[]; total: number }> {
  const bigquery = getBigQueryClient();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.month) {
    conditions.push(`FORMAT_DATE('%Y-%m', tax.Payroll_Month) = @month`);
    params.month = filters.month;
  }
  if (filters.employeeId) {
    conditions.push(`tax.Employee_ID = @employeeId`);
    params.employeeId = filters.employeeId;
  }
  if (filters.search) {
    conditions.push(`(
      CAST(tax.Employee_ID AS STRING) LIKE @search OR
      LOWER(e.Full_Name) LIKE @search OR
      LOWER(e.Official_Email) LIKE @search OR
      LOWER(e.Personal_Email) LIKE @search
    )`);
    params.search = normalizeSearch(filters.search);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const dataQuery = `
    SELECT 
      tax.*,
      e.Full_Name,
      e.Designation,
      e.Department
    FROM ${taxRef} tax
    LEFT JOIN ${employeeRef} e ON tax.Employee_ID = e.Employee_ID
    ${whereClause}
    ORDER BY tax.Payroll_Month DESC, e.Full_Name ASC
    LIMIT @limit OFFSET @offset
  `;

  const countQuery = `
    SELECT COUNT(1) as total
    FROM ${taxRef} tax
    LEFT JOIN ${employeeRef} e ON tax.Employee_ID = e.Employee_ID
    ${whereClause}
  `;

  const [rowsPromise, countPromise] = await Promise.all([
    bigquery.query({
      query: dataQuery,
      params: { ...params, limit, offset },
    }),
    bigquery.query({
      query: countQuery,
      params,
    }),
  ]);

  const rows = rowsPromise[0] as TaxCalculationRecord[];
  const total = Number((countPromise[0][0] as { total: number })?.total ?? 0);

  return { rows, total };
}

export async function fetchTaxByEmployee(employeeId: number): Promise<TaxCalculationRecord[]> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT 
      tax.*,
      e.Full_Name,
      e.Designation,
      e.Department
    FROM ${taxRef} tax
    LEFT JOIN ${employeeRef} e ON tax.Employee_ID = e.Employee_ID
    WHERE tax.Employee_ID = @employeeId
    ORDER BY tax.Payroll_Month DESC
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });
  return rows as TaxCalculationRecord[];
}

