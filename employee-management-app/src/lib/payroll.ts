import "server-only";
import type { SalaryRecord, EOBIRecord } from "@/types/api/payroll";
import type { SalaryFilters, EobiFilters, MonthOption, PayrollSummaryRow, EobiSummary } from "@/types/payroll";
import { getBigQueryClient } from "./bigquery";
import { convertDateToString } from "./formatters";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;
const salaryTable = process.env.BQ_SALARY_TABLE ?? "Employee_Salaries";
const eobiTable = process.env.BQ_EOBI_TABLE ?? "Employee_EOBI";
const employeeTable = process.env.BQ_TABLE ?? "Employees";

if (!projectId || !dataset) {
  throw new Error("Missing BigQuery configuration for payroll tables");
}

const salariesRef = `\`${projectId}.${dataset}.${salaryTable}\``;
const eobiRef = `\`${projectId}.${dataset}.${eobiTable}\``;
const employeeRef = `\`${projectId}.${dataset}.${employeeTable}\``;

const normalizeSearch = (value?: string | null) => (value ? `%${value.toLowerCase()}%` : undefined);

export async function fetchLatestSalary(employeeId: string): Promise<SalaryRecord | null> {
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    return null;
  }
  
  const query = `
    SELECT 
      s.*,
      e.Full_Name AS Employee_Name,
      e.Official_Email,
      e.Personal_Email,
      e.Designation,
      e.Department,
      e.Employment_Status
    FROM ${salariesRef} s
    LEFT JOIN ${employeeRef} e ON s.Employee_ID = e.Employee_ID
    WHERE s.Employee_ID = @employeeId
    ORDER BY s.Payroll_Month DESC, s.Currency ASC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });
  
  const row = rows[0] as SalaryRecord | undefined;
  if (!row) return null;

  // Convert Employee_ID from string to number and normalize dates
  const normalized = {
    ...row,
    Employee_ID: row.Employee_ID !== null && row.Employee_ID !== undefined
      ? (typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID)
      : null,
    Payroll_Month: convertDateToString(row.Payroll_Month) ?? null,
    Loaded_At: row.Loaded_At ? convertDateToString(row.Loaded_At) ?? null : null,
    Created_At: 'Created_At' in row && row.Created_At ? convertDateToString(row.Created_At as unknown) ?? null : null,
    Joining_Date: row.Joining_Date ? convertDateToString(row.Joining_Date) ?? null : null,
    Date_of_Birth: row.Date_of_Birth ? convertDateToString(row.Date_of_Birth) ?? null : null,
    Spouse_DOB: row.Spouse_DOB ? convertDateToString(row.Spouse_DOB) ?? null : null,
    Date_of_Increment: row.Date_of_Increment ? convertDateToString(row.Date_of_Increment) ?? null : null,
    Payable_From: row.Payable_From ? convertDateToString(row.Payable_From) ?? null : null,
    Salary_Effective_Date: row.Salary_Effective_Date ? convertDateToString(row.Salary_Effective_Date) ?? null : null,
  };
  
  return normalized;
}

export async function fetchLatestEOBI(employeeId: string): Promise<EOBIRecord | null> {
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    return null;
  }
  
  const query = `
    SELECT *
    FROM ${eobiRef}
    WHERE Employee_ID = @employeeId
    ORDER BY Payroll_Month DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });
  
  const row = rows[0] as EOBIRecord | undefined;
  if (!row) return null;

  // Convert Employee_ID from string to number and normalize dates
  const normalized = {
    ...row,
    Employee_ID: row.Employee_ID !== null && row.Employee_ID !== undefined
      ? (typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID)
      : null,
    Payroll_Month: convertDateToString(row.Payroll_Month) ?? null,
    From_Date: convertDateToString(row.From_Date) ?? null,
    To_Date: convertDateToString(row.To_Date) ?? null,
    DOJ: row.DOJ ? convertDateToString(row.DOJ) ?? null : null,
    DOB: row.DOB ? convertDateToString(row.DOB) ?? null : null,
    Loaded_At: row.Loaded_At ? convertDateToString(row.Loaded_At) ?? null : null,
  };
  
  return normalized;
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
  
  // Get months from existing data
  const dataQuery = `
    SELECT DISTINCT
      FORMAT_DATE('%Y-%m', Payroll_Month) AS value,
      FORMAT_DATE('%b %Y', Payroll_Month) AS label
    FROM ${eobiRef}
    WHERE Payroll_Month IS NOT NULL
    ORDER BY value DESC
  `;
  const [dataRows] = await bigquery.query({ query: dataQuery });
  const dataMonths = new Set((dataRows as MonthOption[]).map(m => m.value));
  
  // Generate months from January 2020 to current month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (0 = January, 11 = December)
  const months: MonthOption[] = [];
  
  // Start from January 2020
  for (let year = 2020; year <= currentYear; year++) {
    const startMonth = year === 2020 ? 0 : 0; // January
    const endMonth = year === currentYear ? currentMonth : 11; // December or current month
    
    for (let month = startMonth; month <= endMonth; month++) {
      const value = `${year}-${String(month + 1).padStart(2, '0')}`;
      const date = new Date(year, month, 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Use label from data if available, otherwise generate it
      const existingMonth = (dataRows as MonthOption[]).find(m => m.value === value);
      months.push({
        value,
        label: existingMonth?.label || label
      });
    }
  }
  
  // Sort descending (newest first)
  months.sort((a, b) => b.value.localeCompare(a.value));
  
  return months;
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
    conditions.push(`e.Employment_Status = @status`);
    params.status = filters.status;
  }
  if (filters.search) {
    conditions.push(`(
      CAST(s.Employee_ID AS STRING) LIKE @search OR
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
      s.*,
      e.Full_Name AS Employee_Name,
      e.Official_Email,
      e.Personal_Email,
      e.Designation,
      e.Department,
      e.Employment_Status
    FROM ${salariesRef} s
    LEFT JOIN ${employeeRef} e ON s.Employee_ID = e.Employee_ID
    ${whereClause}
    ORDER BY s.Payroll_Month DESC, s.Currency ASC, e.Full_Name ASC
    LIMIT @limit OFFSET @offset
  `;

  const countQuery = `
    SELECT COUNT(1) as total
    FROM ${salariesRef} s
    LEFT JOIN ${employeeRef} e ON s.Employee_ID = e.Employee_ID
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

  // Convert Employee_ID from string to number, normalize dates, and filter out NULL Employee_IDs
  const convertedRows = rows
    .map((row) => {
      const normalized = {
        ...row,
        Employee_ID: row.Employee_ID !== null && row.Employee_ID !== undefined
          ? (typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID)
          : null,
        Payroll_Month: convertDateToString(row.Payroll_Month) ?? null,
        Loaded_At: row.Loaded_At ? convertDateToString(row.Loaded_At) ?? null : null,
        Created_At: 'Created_At' in row && row.Created_At ? convertDateToString(row.Created_At as unknown) ?? null : null,
        Joining_Date: row.Joining_Date ? convertDateToString(row.Joining_Date) ?? null : null,
        Date_of_Birth: row.Date_of_Birth ? convertDateToString(row.Date_of_Birth) ?? null : null,
        Spouse_DOB: row.Spouse_DOB ? convertDateToString(row.Spouse_DOB) ?? null : null,
        Date_of_Increment: row.Date_of_Increment ? convertDateToString(row.Date_of_Increment) ?? null : null,
        Payable_From: row.Payable_From ? convertDateToString(row.Payable_From) ?? null : null,
        Salary_Effective_Date: row.Salary_Effective_Date ? convertDateToString(row.Salary_Effective_Date) ?? null : null,
      };
      
      return normalized;
    })
    .filter((row) => row.Employee_ID !== null); // Filter out records with NULL Employee_ID

  // Still use directory lookup for backward compatibility with old data
  const directoryLookup = await fetchDirectoryLookup();
  const enrichedRows = convertedRows.map((row) => enrichSalaryRow(row, directoryLookup));
  const filteredRows = enrichedRows.filter((row) => shouldIncludeRow(row, filters.month));

  return { rows: filteredRows, total };
}

export async function fetchEobiRecords(filters: EobiFilters): Promise<{ rows: EOBIRecord[]; total: number }> {
  const bigquery = getBigQueryClient();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.month) {
    // Use FORMAT_DATE to match the month format "YYYY-MM"
    // The parameter should be a string like "2025-11"
    conditions.push(`FORMAT_DATE('%Y-%m', eobi.Payroll_Month) = @month`);
    params.month = filters.month;
  }
  if (filters.search) {
    conditions.push(`(
      LOWER(CAST(eobi.Employee_ID AS STRING)) LIKE @search OR
      LOWER(e.Full_Name) LIKE @search OR
      LOWER(eobi.EOBI_NO) LIKE @search OR
      LOWER(COALESCE(e.CNIC_ID, '')) LIKE @search
    )`);
    params.search = normalizeSearch(filters.search);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const dataQuery = `
    SELECT 
      eobi.*,
      e.Full_Name AS NAME,
      e.CNIC_ID AS CNIC,
      e.EOBI_Number
    FROM ${eobiRef} eobi
    LEFT JOIN ${employeeRef} e ON SAFE_CAST(eobi.Employee_ID AS INT64) = SAFE_CAST(e.Employee_ID AS INT64)
    ${whereClause}
    ORDER BY eobi.Payroll_Month DESC, e.Full_Name ASC
    LIMIT @limit OFFSET @offset
  `;

  const countQuery = `
    SELECT COUNT(1) as total
    FROM ${eobiRef} eobi
    LEFT JOIN ${employeeRef} e ON SAFE_CAST(eobi.Employee_ID AS INT64) = SAFE_CAST(e.Employee_ID AS INT64)
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

  // Normalize dates in EOBI records
  const normalizedRows = rows.map((row) => {
    const normalized = {
      ...row,
      Payroll_Month: convertDateToString(row.Payroll_Month) ?? null,
      From_Date: convertDateToString(row.From_Date) ?? null,
      To_Date: convertDateToString(row.To_Date) ?? null,
      DOJ: row.DOJ ? convertDateToString(row.DOJ) ?? null : null,
      DOB: row.DOB ? convertDateToString(row.DOB) ?? null : null,
      Loaded_At: row.Loaded_At ? convertDateToString(row.Loaded_At) ?? null : null,
    };
    
    return normalized;
  });

  return { rows: normalizedRows, total };
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
  Employment_End_Date: string | null;
  Employment_End_Date_ISO: string | null;
  Employment_Status: string | null;
  Full_Name_Key?: string | null;
  Key: string | null;
};

type DirectoryLookup = {
  byEmail: Map<string, DirectoryRecord>;
  byId: Map<string, DirectoryRecord>;
  byKey: Map<string, DirectoryRecord>;
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

const normaliseId = (value?: string | null) => {
  const trimmed = preferValue(value);
  return trimmed ? trimmed.toLowerCase() : null;
};

const normaliseKey = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
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
      CAST(Employee_ID AS STRING) AS Employee_ID,
      Full_Name,
      Department,
      LOWER(Official_Email) AS Official_Email,
      LOWER(Personal_Email) AS Personal_Email,
      Employment_End_Date,
      Employment_Status,
      LOWER(TRIM(Full_Name)) AS Full_Name_Key
    FROM ${employeeRef}
  `;
  const [rows] = await bigquery.query({ query });
  const byEmail = new Map<string, DirectoryRecord>();
  const byId = new Map<string, DirectoryRecord>();
  const byKey = new Map<string, DirectoryRecord>();

  (rows as DirectoryRecord[]).forEach((row) => {
    // Normalize Employment_End_Date using convertDateToString to handle BigQueryDate objects
    const employmentEndDate = convertDateToString(row.Employment_End_Date);
    const record: DirectoryRecord = {
      Employee_ID: preferValue(String(row.Employee_ID)),
      Full_Name: preferValue(row.Full_Name),
      Department: preferValue(row.Department),
      Official_Email: normaliseEmail(row.Official_Email),
      Personal_Email: normaliseEmail(row.Personal_Email),
      Employment_End_Date: employmentEndDate,
      Employment_End_Date_ISO: employmentEndDate,
      Employment_Status: preferValue(row.Employment_Status),
      Full_Name_Key: normaliseKey(row.Full_Name_Key ?? row.Full_Name),
      Key: normaliseKey(row.Full_Name_Key ?? row.Full_Name ?? String(row.Employee_ID)),
    };

    const idKey = normaliseId(record.Employee_ID);
    if (idKey) {
      byId.set(idKey, record);
    }

    if (record.Official_Email) {
      byEmail.set(record.Official_Email, record);
    }
    if (record.Personal_Email) {
      byEmail.set(record.Personal_Email, record);
    }

    if (record.Key) {
      byKey.set(record.Key, record);
    }
  });

  const lookup = { byEmail, byId, byKey };
  directoryCache = { lookup, fetchedAt: now };
  return lookup;
}

const enrichSalaryRow = (row: SalaryRecord, lookup: DirectoryLookup): SalaryRecord => {
  // Skip enrichment if Employee_ID is NULL - this prevents creating duplicates
  // Note: NULL Employee_IDs are filtered out before enrichment, but this is a safety check
  if (row.Employee_ID === null || row.Employee_ID === undefined) {
    return row;
  }

  // If row already has Employee_Name from join, use it directly (no need to enrich)
  if (row.Employee_Name && row.Department && row.Employment_Status) {
    return row;
  }
  
  // Employee_ID is now always a number (INT64) - convert to string for lookup
  const idKey = row.Employee_ID ? normaliseId(String(row.Employee_ID)) : null;
  const officialKey = normaliseEmail(row.Official_Email);
  const personalKey = normaliseEmail(row.Personal_Email);
  const keyKey = normaliseKey(
    (typeof row.Key === "string" ? row.Key : null) ??
      row.Employee_Name ??
      row.Official_Email ??
      row.Personal_Email
  );

  // Try to find matching directory record by ID first, then email, then name
  const directoryRecord =
    (idKey && lookup.byId.get(idKey)) ||
    (officialKey && lookup.byEmail.get(officialKey)) ||
    (personalKey && lookup.byEmail.get(personalKey)) ||
    (keyKey && lookup.byKey.get(keyKey));

  // If no match found, return row as-is (don't create new data)
  if (!directoryRecord) {
    return row;
  }

  // Enrich with directory data, but preserve existing Employee_ID (never change it)
  // Employee_ID is number, keep it as number - never override with directory lookup
  const employeeId = row.Employee_ID; // Always preserve the original Employee_ID
  const employeeName =
    preferValue(row.Employee_Name) ?? directoryRecord.Full_Name ?? row.Employee_Name;
  const department =
    preferValue(row.Department) ?? directoryRecord.Department ?? row.Department;
  const employmentStatus =
    preferValue(row.Employment_Status) ?? directoryRecord.Employment_Status ?? row.Employment_Status;
  const employmentEndDate =
    (typeof row.Employment_End_Date === "string" ? row.Employment_End_Date : null) ??
    directoryRecord.Employment_End_Date ??
    (typeof row.Employment_End_Date === "object" &&
    row.Employment_End_Date !== null &&
    "value" in row.Employment_End_Date
      ? String((row.Employment_End_Date as { value: unknown }).value)
      : null);
  const rowRecord = row as unknown as Record<string, unknown>;
  const employmentEndDateIso =
    (typeof rowRecord["Employment_End_Date_ISO"] === "string"
      ? (rowRecord["Employment_End_Date_ISO"] as string)
      : null) ??
    directoryRecord.Employment_End_Date_ISO ??
    employmentEndDate;

  // Return enriched row - Employee_ID is never changed, only other fields are enriched
  // Normalize all date fields after enrichment
  const enriched = {
    ...row,
    Employee_ID: employeeId, // Always preserve original Employee_ID
    Employee_Name: employeeName ?? row.Employee_Name,
    Department: department ?? row.Department,
    Employment_Status: employmentStatus ?? row.Employment_Status,
    Employment_End_Date: employmentEndDate ?? row.Employment_End_Date,
    Employment_End_Date_ISO: employmentEndDateIso ?? null,
    Key: (typeof row.Key === "string" ? row.Key : null) ?? directoryRecord.Key ?? null,
  };
  
  // Normalize all date fields (including Loaded_At, Created_At, Updated_At)
  return {
    ...enriched,
    Joining_Date: enriched.Joining_Date ? convertDateToString(enriched.Joining_Date) ?? null : null,
    Date_of_Birth: enriched.Date_of_Birth ? convertDateToString(enriched.Date_of_Birth) ?? null : null,
    Spouse_DOB: enriched.Spouse_DOB ? convertDateToString(enriched.Spouse_DOB) ?? null : null,
    Employment_End_Date: enriched.Employment_End_Date ? convertDateToString(enriched.Employment_End_Date) ?? null : null,
    Probation_End_Date: enriched.Probation_End_Date ? convertDateToString(enriched.Probation_End_Date) ?? null : null,
    Date_of_Increment: enriched.Date_of_Increment ? convertDateToString(enriched.Date_of_Increment) ?? null : null,
    Payable_From: enriched.Payable_From ? convertDateToString(enriched.Payable_From) ?? null : null,
    Salary_Effective_Date: enriched.Salary_Effective_Date ? convertDateToString(enriched.Salary_Effective_Date) ?? null : null,
    Loaded_At: enriched.Loaded_At ? convertDateToString(enriched.Loaded_At) ?? null : null,
    Created_At: 'Created_At' in enriched && enriched.Created_At ? convertDateToString(enriched.Created_At as unknown) ?? null : null,
    Updated_At: 'Updated_At' in enriched && enriched.Updated_At ? convertDateToString(enriched.Updated_At as unknown) ?? null : null,
  };
};

const extractMonthKey = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed.slice(0, 7);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    return trimmed.length >= 7 ? trimmed.slice(0, 7) : null;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    }
  }
  if (typeof value === "object" && value !== null) {
    if ("value" in (value as Record<string, unknown>)) {
      return extractMonthKey((value as Record<string, unknown>).value);
    }
  }
  return null;
};

const shouldIncludeRow = (row: SalaryRecord, filterMonth?: string | null) => {
  if (!filterMonth) return true;
  const status = preferValue(row.Employment_Status ?? row.Status);
  if (status !== "Resigned/Terminated") {
    return true;
  }
  const rowRecord = row as unknown as Record<string, unknown>;
  const endMonth =
    extractMonthKey(rowRecord["Employment_End_Date_ISO"]) ??
    extractMonthKey(row.Employment_End_Date) ??
    extractMonthKey(row.Payroll_Month);
  if (!endMonth) {
    return false;
  }
  return endMonth === filterMonth;
};

export const shapeSalaryRow = (row: SalaryRecord) => ({
  Employee_ID: row.Employee_ID,
  Employee_Name: row.Employee_Name,
  Department: row.Department,
  Payroll_Month: row.Payroll_Month,
  Currency: row.Currency,
  Gross_Income: row.Gross_Income,
  Net_Income: row.Net_Income,
  Tax_Deduction: row.Tax_Deduction,
  Employment_Status: row.Employment_Status ?? row.Status,
  Status: row.Status,
  Official_Email: row.Official_Email,
  Personal_Email: row.Personal_Email,
  Key: (typeof row.Key === "string" ? row.Key : null) ?? null,
});
