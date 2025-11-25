import "server-only";
import type { SalaryRecord, EOBIRecord } from "@/types/api/payroll";
import type { SalaryFilters, EobiFilters, MonthOption, PayrollSummaryRow, EobiSummary } from "@/types/payroll";
import { getBigQueryClient } from "./bigquery";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;
const salaryTable = process.env.BQ_SALARY_TABLE ?? "EmployeeSalaries_v1";
const eobiTable = process.env.BQ_EOBI_TABLE ?? "EmployeeEOBI_v1";
const employeeTable = process.env.BQ_TABLE ?? "EmployeeDirectoryLatest_v1";

if (!projectId || !dataset) {
  throw new Error("Missing BigQuery configuration for payroll tables");
}

const salariesRef = `\`${projectId}.${dataset}.${salaryTable}\``;
const eobiRef = `\`${projectId}.${dataset}.${eobiTable}\``;
const employeeRef = `\`${projectId}.${dataset}.${employeeTable}\``;

const normalizeSearch = (value?: string | null) => (value ? `%${value.toLowerCase()}%` : undefined);

export async function fetchLatestSalary(employeeId: string): Promise<SalaryRecord | null> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT *
    FROM ${salariesRef}
    WHERE Employee_ID = @employeeId
    ORDER BY Payroll_Month DESC, Currency ASC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });
  return (rows[0] as SalaryRecord) ?? null;
}

export async function fetchLatestEOBI(employeeId: string): Promise<EOBIRecord | null> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT *
    FROM ${eobiRef}
    WHERE Employee_ID = @employeeId
    ORDER BY Payroll_Month DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });
  return (rows[0] as EOBIRecord) ?? null;
}

export async function fetchSalaryMonths(): Promise<MonthOption[]> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT DISTINCT
      FORMAT_DATE('%Y-%m', Payroll_Month) AS value,
      FORMAT_DATE('%b %Y', Payroll_Month) AS label
    FROM ${salariesRef}
    WHERE Payroll_Month IS NOT NULL
    ORDER BY value DESC
  `;
  const [rows] = await bigquery.query({ query });
  return rows as MonthOption[];
}

export async function fetchEobiMonths(): Promise<MonthOption[]> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT DISTINCT
      FORMAT_DATE('%Y-%m', Payroll_Month) AS value,
      FORMAT_DATE('%b %Y', Payroll_Month) AS label
    FROM ${eobiRef}
    WHERE Payroll_Month IS NOT NULL
    ORDER BY value DESC
  `;
  const [rows] = await bigquery.query({ query });
  return rows as MonthOption[];
}

export async function fetchSalaries(filters: SalaryFilters): Promise<{ rows: SalaryRecord[]; total: number }> {
  const bigquery = getBigQueryClient();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.month) {
    conditions.push(`FORMAT_DATE('%Y-%m', s.Payroll_Month) = @month`);
    params.month = filters.month;
  }
  if (filters.currency) {
    conditions.push(`s.Currency = @currency`);
    params.currency = filters.currency;
  }
  if (filters.status) {
    conditions.push(`(COALESCE(s.Employment_Status, dir.Employment_Status) = @status OR s.Status = @status)`);
    params.status = filters.status;
  }
  if (filters.search) {
    conditions.push(`(
      LOWER(COALESCE(s.Employee_ID, dir.Employee_ID)) LIKE @search OR
      LOWER(COALESCE(s.Employee_Name, dir.Full_Name)) LIKE @search OR
      LOWER(COALESCE(s.Official_Email, dir.Official_Email)) LIKE @search OR
      LOWER(COALESCE(s.Personal_Email, dir.Personal_Email)) LIKE @search
    )`);
    params.search = normalizeSearch(filters.search);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const dataQuery = `
    WITH joined_data AS (
      SELECT 
        s.*,
        dir.Employee_ID AS dir_Employee_ID,
        dir.Full_Name AS dir_Full_Name,
        dir.Department AS dir_Department
      FROM ${salariesRef} s
      LEFT JOIN ${employeeRef} dir ON s.Employee_ID = dir.Employee_ID
      ${whereClause}
    )
    SELECT 
      * EXCEPT(Employee_ID, Employee_Name, Department, dir_Employee_ID, dir_Full_Name, dir_Department),
      COALESCE(Employee_ID, dir_Employee_ID) AS Employee_ID,
      COALESCE(Employee_Name, dir_Full_Name) AS Employee_Name,
      COALESCE(Department, dir_Department) AS Department
    FROM joined_data
    ORDER BY Payroll_Month DESC, Currency ASC, COALESCE(Employee_Name, dir_Full_Name) ASC
    LIMIT @limit OFFSET @offset
  `;

  const countQuery = `
    SELECT COUNT(1) as total
    FROM ${salariesRef} s
    LEFT JOIN ${employeeRef} dir ON s.Employee_ID = dir.Employee_ID
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

  const rows = rowsPromise[0] as SalaryRecord[];
  const total = Number((countPromise[0][0] as { total: number })?.total ?? 0);

  return { rows, total };
}

export async function fetchEobiRecords(filters: EobiFilters): Promise<{ rows: EOBIRecord[]; total: number }> {
  const bigquery = getBigQueryClient();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.month) {
    conditions.push(`FORMAT_DATE('%Y-%m', Payroll_Month) = @month`);
    params.month = filters.month;
  }
  if (filters.search) {
    conditions.push(`(
      LOWER(Employee_ID) LIKE @search OR
      LOWER(NAME) LIKE @search OR
      LOWER(EOBI_NO) LIKE @search OR
      REPLACE(CNIC, '-', '') LIKE REPLACE(@search, '-', '')
    )`);
    params.search = normalizeSearch(filters.search);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const dataQuery = `
    SELECT *
    FROM ${eobiRef}
    ${whereClause}
    ORDER BY Payroll_Month DESC, NAME ASC
    LIMIT @limit OFFSET @offset
  `;

  const countQuery = `
    SELECT COUNT(1) as total
    FROM ${eobiRef}
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

  const rows = rowsPromise[0] as EOBIRecord[];
  const total = Number((countPromise[0][0] as { total: number })?.total ?? 0);

  return { rows, total };
}

export async function fetchPayrollSummary(month: string): Promise<PayrollSummaryRow[]> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT
      Currency,
      COUNT(1) AS headcount,
      SUM(Net_Income) AS netIncome,
      SUM(Gross_Income) AS grossIncome
    FROM ${salariesRef}
    WHERE FORMAT_DATE('%Y-%m', Payroll_Month) = @month
    GROUP BY Currency
    ORDER BY Currency
  `;
  const [rows] = await bigquery.query({
    query,
    params: { month },
  });
  return (rows as Record<string, unknown>[]).map((row) => ({
    currency: String(row.Currency ?? row.currency ?? "PKR"),
    headcount: Number(row.headcount ?? 0),
    netIncome: Number(row.netIncome ?? 0),
    grossIncome: Number(row.grossIncome ?? 0),
  }));
}

export async function fetchEobiSummary(month: string): Promise<EobiSummary> {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT
      COUNT(1) AS headcount,
      SUM(Employee_Contribution) AS employeeContribution,
      SUM(Employer_Contribution) AS employerContribution,
      SUM(Total_EOBI) AS totalContribution
    FROM ${eobiRef}
    WHERE FORMAT_DATE('%Y-%m', Payroll_Month) = @month
  `;
  const [rows] = await bigquery.query({
    query,
    params: { month },
  });
  const raw = rows[0] as EobiSummary | undefined;
  return {
    headcount: Number(raw?.headcount ?? 0),
    employeeContribution: Number(raw?.employeeContribution ?? 0),
    employerContribution: Number(raw?.employerContribution ?? 0),
    totalContribution: Number(raw?.totalContribution ?? 0),
  };
}
