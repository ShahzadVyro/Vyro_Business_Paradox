import "server-only";
import type { OPDBenefitRecord, OPDBalance, OPDFilters, OPDListResponse } from "@/types/opd";
import type { MonthOption } from "@/types/payroll";
import { getBigQueryClient } from "./bigquery";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;
const opdTable = process.env.BQ_OPD_TABLE ?? "Employee_OPD_Benefits";
const employeeTable = process.env.BQ_TABLE ?? "Employees";

if (!projectId || !dataset) {
  throw new Error("Missing BigQuery configuration for OPD tables");
}

const opdRef = `\`${projectId}.${dataset}.${opdTable}\``;
const employeeRef = `\`${projectId}.${dataset}.${employeeTable}\``;

const normalizeSearch = (value?: string | null) => (value ? `%${value.toLowerCase()}%` : undefined);

export async function fetchOPDMonths(): Promise<MonthOption[]> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT DISTINCT
      FORMAT_DATE('%Y-%m', Benefit_Month) AS value,
      FORMAT_DATE('%b %Y', Benefit_Month) AS label
    FROM ${opdRef}
    WHERE Benefit_Month IS NOT NULL
    ORDER BY value DESC
  `;
  const [rows] = await bigquery.query({ query });
  return rows as MonthOption[];
}

export async function fetchOPDBenefits(filters: OPDFilters): Promise<{ rows: OPDBenefitRecord[]; total: number }> {
  const bigquery = getBigQueryClient();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.month) {
    conditions.push(`FORMAT_DATE('%Y-%m', opd.Benefit_Month) = @month`);
    params.month = filters.month;
  }
  if (filters.employeeId) {
    conditions.push(`opd.Employee_ID = @employeeId`);
    params.employeeId = filters.employeeId;
  }
  if (filters.currency) {
    conditions.push(`opd.Currency = @currency`);
    params.currency = filters.currency;
  }
  if (filters.search) {
    conditions.push(`(
      CAST(opd.Employee_ID AS STRING) LIKE @search OR
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
      opd.*,
      e.Full_Name,
      e.Designation,
      e.Department
    FROM ${opdRef} opd
    LEFT JOIN ${employeeRef} e ON opd.Employee_ID = e.Employee_ID
    ${whereClause}
    ORDER BY opd.Benefit_Month DESC, e.Full_Name ASC
    LIMIT @limit OFFSET @offset
  `;

  const countQuery = `
    SELECT COUNT(1) as total
    FROM ${opdRef} opd
    LEFT JOIN ${employeeRef} e ON opd.Employee_ID = e.Employee_ID
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

  const rows = rowsPromise[0] as OPDBenefitRecord[];
  const total = Number((countPromise[0][0] as { total: number })?.total ?? 0);

  return { rows, total };
}

export async function fetchOPDBalance(employeeId: number): Promise<OPDBalance | null> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT
      Employee_ID,
      SUM(Contribution_Amount) AS Total_Contributions,
      SUM(Claimed_Amount) AS Total_Claimed,
      SUM(COALESCE(Contribution_Amount, 0) - COALESCE(Claimed_Amount, 0)) AS Available_Balance,
      MAX(Benefit_Month) AS Last_Contribution_Month,
      MAX(CASE WHEN Claimed_Amount > 0 THEN Benefit_Month END) AS Last_Claim_Month
    FROM ${opdRef}
    WHERE Employee_ID = @employeeId
    GROUP BY Employee_ID
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });
  if (rows.length === 0) return null;
  const row = rows[0] as OPDBalance;
  return {
    Employee_ID: Number(row.Employee_ID),
    Total_Contributions: Number(row.Total_Contributions ?? 0),
    Total_Claimed: Number(row.Total_Claimed ?? 0),
    Available_Balance: Number(row.Available_Balance ?? 0),
    Last_Contribution_Month: row.Last_Contribution_Month ? String(row.Last_Contribution_Month).slice(0, 10) : null,
    Last_Claim_Month: row.Last_Claim_Month ? String(row.Last_Claim_Month).slice(0, 10) : null,
  };
}

export async function fetchOPDByEmployee(employeeId: number): Promise<OPDBenefitRecord[]> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT 
      opd.*,
      e.Full_Name,
      e.Designation,
      e.Department
    FROM ${opdRef} opd
    LEFT JOIN ${employeeRef} e ON opd.Employee_ID = e.Employee_ID
    WHERE opd.Employee_ID = @employeeId
    ORDER BY opd.Benefit_Month DESC
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });
  return rows as OPDBenefitRecord[];
}

