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
    conditions.push(`FORMAT_DATE('%Y-%m', Payroll_Month) = @month`);
    params.month = filters.month;
  }
  if (filters.currency) {
    conditions.push(`Currency = @currency`);
    params.currency = filters.currency;
  }
  if (filters.status) {
    conditions.push(`(Employment_Status = @status OR Status = @status)`);
    params.status = filters.status;
  }
  if (filters.search) {
    conditions.push(`(
      LOWER(Employee_ID) LIKE @search OR
      LOWER(Employee_Name) LIKE @search OR
      LOWER(Official_Email) LIKE @search OR
      LOWER(Personal_Email) LIKE @search
    )`);
    params.search = normalizeSearch(filters.search);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const dataQuery = `
    SELECT *
    FROM ${salariesRef}
    ${whereClause}
    ORDER BY Payroll_Month DESC, Currency ASC, Employee_Name ASC
    LIMIT @limit OFFSET @offset
  `;

  const countQuery = `
    SELECT COUNT(1) as total
    FROM ${salariesRef}
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

  const directoryLookup = await fetchDirectoryLookup();
  const enrichedRows = rows.map((row) => enrichSalaryRow(row, directoryLookup));

  return { rows: enrichedRows, total };
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

type DirectoryRecord = {
  Employee_ID: string | null;
  Full_Name: string | null;
  Department: string | null;
  Official_Email: string | null;
  Personal_Email: string | null;
};

type DirectoryLookup = {
  byEmail: Map<string, DirectoryRecord>;
};

const DIRECTORY_CACHE_TTL_MS = 1000 * 60; // 1 minute
let directoryCache: { lookup: DirectoryLookup; fetchedAt: number } | null = null;

const normaliseEmail = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
};

const preferValue = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
};

async function fetchDirectoryLookup(): Promise<DirectoryLookup> {
  const now = Date.now();
  if (directoryCache && now - directoryCache.fetchedAt < DIRECTORY_CACHE_TTL_MS) {
    return directoryCache.lookup;
  }

  const bigquery = getBigQueryClient();
  const query = `
    SELECT
      Employee_ID,
      Full_Name,
      Department,
      LOWER(Official_Email) AS Official_Email,
      LOWER(Personal_Email) AS Personal_Email
    FROM ${employeeRef}
  `;
  const [rows] = await bigquery.query({ query });
  const byEmail = new Map<string, DirectoryRecord>();

  (rows as DirectoryRecord[]).forEach((row) => {
    const official = normaliseEmail(row.Official_Email);
    const personal = normaliseEmail(row.Personal_Email);
    if (official) {
      byEmail.set(official, row);
    }
    if (personal) {
      byEmail.set(personal, row);
    }
  });

  const lookup = { byEmail };
  directoryCache = { lookup, fetchedAt: now };
  return lookup;
}

const enrichSalaryRow = (row: SalaryRecord, lookup: DirectoryLookup): SalaryRecord => {
  const officialKey = normaliseEmail(row.Official_Email);
  const personalKey = normaliseEmail(row.Personal_Email);
  const directoryRecord =
    (officialKey && lookup.byEmail.get(officialKey)) ||
    (personalKey && lookup.byEmail.get(personalKey));

  if (!directoryRecord) {
    return row;
  }

  const employeeId = preferValue(row.Employee_ID) ?? directoryRecord.Employee_ID ?? row.Employee_ID;
  const employeeName =
    preferValue(row.Employee_Name) ?? directoryRecord.Full_Name ?? row.Employee_Name;
  const department =
    preferValue(row.Department) ?? directoryRecord.Department ?? row.Department;

  return {
    ...row,
    Employee_ID: employeeId ?? row.Employee_ID,
    Employee_Name: employeeName ?? row.Employee_Name,
    Department: department ?? row.Department,
  };
};
