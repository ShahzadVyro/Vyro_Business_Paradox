import "server-only";
import type { SalaryRecord, EOBIRecord } from "@/types/api/payroll";
import type { SalaryFilters, EobiFilters, MonthOption, PayrollSummaryRow, EobiSummary } from "@/types/payroll";
import { getBigQueryClient } from "./bigquery";
import { convertDateToString } from "./formatters";
import { 
  calculateProratedPay, 
  getTotalDaysInMonth, 
  calculateWorkedDays,
  calculateGrossIncome 
} from "./payroll-calculations";

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

  // Note: s.* includes all columns from Employee_Salaries table
  // Explicit column references below are for aliasing/joining purposes
  // If any of these columns don't exist in the table, the query will fail
  // and the error will be logged with full details for debugging
  const projectId = process.env.GCP_PROJECT_ID;
  const dataset = process.env.BQ_DATASET;
  const payTemplateIncrementsTable = `\`${projectId}.${dataset}.Pay_Template_Increments\``;
  
  const dataQuery = `
    SELECT 
      s.*,
      e.Full_Name AS Employee_Name,
      e.Official_Email,
      e.Personal_Email,
      e.Designation,
      e.Department,
      e.Employment_Status,
      e.Joining_Date,
      e.Employment_End_Date,
      e.Probation_End_Date,
      COALESCE(e.Official_Email, e.Personal_Email) AS Email,
      e.Joining_Date AS Date_of_Joining_Display,
      e.Employment_End_Date AS Date_of_Leaving_Display,
      -- Join with increments table to get increment data for this month
      inc.Updated_Salary AS Increment_Amount_From_Template,
      inc.Effective_Date AS Increment_Date_From_Template,
      -- Calculate last month's salary (from previous month's Gross_Income)
      prev.Gross_Income AS Last_Month_Salary_From_Prev,
      CASE 
        WHEN s.Payroll_Month IS NOT NULL 
        THEN FORMAT_DATE('%b %Y', s.Payroll_Month) 
        ELSE NULL 
      END AS Month_Abbrev
    FROM ${salariesRef} s
    LEFT JOIN ${employeeRef} e ON s.Employee_ID = e.Employee_ID
    -- Join with increments table for this payroll month
    LEFT JOIN ${payTemplateIncrementsTable} inc 
      ON s.Employee_ID = inc.Employee_ID 
      AND FORMAT_DATE('%Y-%m', s.Payroll_Month) = inc.Month
      AND s.Currency = inc.Currency
    -- Join with previous month's salary to get last month's gross income
    LEFT JOIN ${salariesRef} prev 
      ON s.Employee_ID = prev.Employee_ID 
      AND s.Currency = prev.Currency
      AND prev.Payroll_Month = DATE_SUB(DATE_TRUNC(s.Payroll_Month, MONTH), INTERVAL 1 MONTH)
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

  const queryStartTime = Date.now();
  console.log('[FETCH_SALARIES] Starting queries', { filters, limit, offset });
  
  let rows: SalaryRecord[] = [];
  let total = 0;
  
  try {
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

    const queryEndTime = Date.now();
    console.log('[FETCH_SALARIES] Queries completed', { 
      duration: `${queryEndTime - queryStartTime}ms`,
      rowsCount: rowsPromise[0]?.length ?? 0,
      total: countPromise[0]?.[0] 
    });

    rows = rowsPromise[0] as SalaryRecord[];
    total = Number((countPromise[0][0] as { total: number })?.total ?? 0);
  } catch (error) {
    const queryEndTime = Date.now();
    console.error('[FETCH_SALARIES] Query error', {
      duration: `${queryEndTime - queryStartTime}ms`,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      query: dataQuery.substring(0, 200) + '...',
      params: { ...params, limit, offset }
    });
    throw error;
  }

  // Convert Employee_ID from string to number, normalize dates, and filter out NULL Employee_IDs
  let convertedRows: SalaryRecord[] = [];
  try {
    console.log('[FETCH_SALARIES] Starting data transformation', { rowsCount: rows.length });
    const mappedRows = rows
      .map((row): SalaryRecord | null => {
        try {
          // Extract employee fields from join
          const employeeName = (row as any).Employee_Name ?? row.Employee_Name ?? null;
          const designation = (row as any).Designation ?? row.Designation ?? null;
          const department = (row as any).Department ?? row.Department ?? null;
          const joiningDate = (row as any).Date_of_Joining_Display 
            ? convertDateToString((row as any).Date_of_Joining_Display) ?? null 
            : (row.Joining_Date ? convertDateToString(row.Joining_Date) ?? null : null);
          const leavingDate = (row as any).Date_of_Leaving_Display 
            ? convertDateToString((row as any).Date_of_Leaving_Display) ?? null 
            : (row.Employment_End_Date ? convertDateToString(row.Employment_End_Date) ?? null : null);
          const email = (row as any).Email ?? row.Official_Email ?? row.Personal_Email ?? null;
          
          // Debug logging for missing employee fields
          if (!employeeName && row.Employee_ID) {
            console.warn('[FETCH_SALARIES] Employee join may have failed', {
              employeeId: row.Employee_ID,
              hasDesignation: !!designation,
              hasDepartment: !!department,
              hasEmail: !!email
            });
          }
          
          // Get payroll month for calculations
          const payrollMonth = convertDateToString(row.Payroll_Month) ?? null;
          // Extract YYYY-MM from date string (handles both YYYY-MM-DD and YYYY-MM formats)
          let payrollMonthDate: Date | null = null;
          if (payrollMonth) {
            const dateMatch = payrollMonth.match(/^(\d{4})-(\d{2})/);
            if (dateMatch) {
              const [, year, month] = dateMatch;
              payrollMonthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
            } else {
              // Fallback: try parsing the full string
              const parsed = Date.parse(payrollMonth);
              if (!Number.isNaN(parsed)) {
                payrollMonthDate = new Date(parsed);
              }
            }
          }
          
          // Calculate Worked_Days if missing
          let workedDays = row.Worked_Days;
          if ((!workedDays || workedDays === null) && payrollMonthDate) {
            workedDays = calculateWorkedDays(joiningDate, leavingDate, payrollMonthDate);
          }
          
          // Get total days in month for calculations
          const totalDaysInMonth = payrollMonthDate ? getTotalDaysInMonth(payrollMonthDate) : 30;
          
          // Get increment data from joined table if not already in salary record
          const incrementAmountFromTemplate = (row as any).Increment_Amount_From_Template ?? null;
          const incrementDateFromTemplate = (row as any).Increment_Date_From_Template 
            ? convertDateToString((row as any).Increment_Date_From_Template) ?? null 
            : null;
          
          // Use increment from template if salary record doesn't have it
          const newAdditionIncrementDecrement = (row as any).New_Addition_Increment_Decrement 
            ?? incrementAmountFromTemplate 
            ?? null;
          const dateOfIncrementDecrement = (row as any).Date_of_Increment_Decrement 
            ?? incrementDateFromTemplate 
            : null;
          
          // Get last month's salary from joined table if not already in salary record
          const lastMonthSalaryFromPrev = (row as any).Last_Month_Salary_From_Prev ?? null;
          const lastMonthSalary = (row as any).Last_Month_Salary 
            ?? lastMonthSalaryFromPrev 
            ?? null;
          
          // Get Regular_Pay (base salary)
          let regularPay = row.Regular_Pay;
          
          // Calculate Revised_with_OPD if missing (Regular Pay + 21 for USD if not in probation)
          let revisedWithOPD = (row as any).Revised_with_OPD ?? row.Revised_with_OPD ?? null;
          if ((!revisedWithOPD || revisedWithOPD === null) && regularPay && row.Currency === "USD" && payrollMonthDate) {
            // Check if employee is in probation
            const probationEndDate = (row as any).Probation_End_Date 
              ? new Date((row as any).Probation_End_Date) 
              : null;
            const isInProbation = probationEndDate && probationEndDate > payrollMonthDate;
            
            if (!isInProbation) {
              revisedWithOPD = regularPay + 21;
            } else {
              revisedWithOPD = regularPay;
            }
          } else if ((!revisedWithOPD || revisedWithOPD === null) && regularPay) {
            // For PKR or if already past probation, Revised_with_OPD = Regular_Pay
            revisedWithOPD = regularPay;
          }
          
          // Calculate Prorated_Pay if missing
          let proratedPay = row.Prorated_Pay;
          if ((!proratedPay || proratedPay === null) && revisedWithOPD && workedDays && totalDaysInMonth > 0) {
            proratedPay = calculateProratedPay(revisedWithOPD, totalDaysInMonth, workedDays);
          }
          
          // Recalculate Gross_Income if components are available
          let grossIncome = row.Gross_Income;
          if ((!grossIncome || grossIncome === null) && proratedPay !== null) {
            grossIncome = calculateGrossIncome(
              proratedPay,
              row.Performance_Bonus ?? null,
              row.Paid_Overtime ?? null,
              row.Reimbursements ?? null,
              row.Other ?? null,
              (row as any).Payable_from_Last_Month ?? row.Payable_from_Last_Month ?? null
            );
          }
          
          const normalized = {
            ...row,
            Employee_ID: row.Employee_ID !== null && row.Employee_ID !== undefined
              ? (typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID)
              : null,
            Employee_Name: employeeName ?? row.Employee_Name ?? null,
            Designation: designation ?? row.Designation ?? null,
            Department: department ?? row.Department ?? null,
            Payroll_Month: payrollMonth,
            Loaded_At: row.Loaded_At ? convertDateToString(row.Loaded_At) ?? null : null,
            Created_At: 'Created_At' in row && row.Created_At ? convertDateToString(row.Created_At as unknown) ?? null : null,
            Joining_Date: joiningDate,
            Date_of_Birth: row.Date_of_Birth ? convertDateToString(row.Date_of_Birth) ?? null : null,
            Spouse_DOB: row.Spouse_DOB ? convertDateToString(row.Spouse_DOB) ?? null : null,
            Date_of_Increment: row.Date_of_Increment ? convertDateToString(row.Date_of_Increment) ?? null : null,
            Payable_From: row.Payable_From ? convertDateToString(row.Payable_From) ?? null : null,
            Salary_Effective_Date: row.Salary_Effective_Date ? convertDateToString(row.Salary_Effective_Date) ?? null : null,
            // Date fields
            Date_of_Joining: joiningDate,
            Date_of_Leaving: leavingDate,
            Date_of_Increment_Decrement: row.Date_of_Increment_Decrement ? convertDateToString(row.Date_of_Increment_Decrement) ?? null : null,
            // Employee fields
            Email: email,
            Official_Email: row.Official_Email ?? null,
            Personal_Email: row.Personal_Email ?? null,
            // Calculated fields
            Worked_Days: workedDays ?? row.Worked_Days ?? null,
            Regular_Pay: regularPay ?? row.Regular_Pay ?? null,
            Revised_with_OPD: revisedWithOPD,
            Prorated_Pay: proratedPay ?? row.Prorated_Pay ?? null,
            Gross_Income: grossIncome ?? row.Gross_Income ?? null,
            // Other fields
            Month_Key: (row as any).Month_Key ?? null,
            Key: (row as any).Key ?? null,
            Status: (row as any).Status ?? null,
            Last_Month_Salary: lastMonthSalary,
            New_Addition_Increment_Decrement: newAdditionIncrementDecrement,
            Date_of_Increment_Decrement: dateOfIncrementDecrement,
            Payable_from_Last_Month: (row as any).Payable_from_Last_Month ?? null,
            Salary_Status: (row as any).Salary_Status ?? "HOLD",
            PaySlip_Status: (row as any).PaySlip_Status ?? "Not Sent",
            Month: (row as any).Month_Abbrev ?? null,
          };
          
          return normalized;
        } catch (rowError) {
          console.error('[FETCH_SALARIES] Error transforming row', {
            error: rowError instanceof Error ? {
              message: rowError.message,
              stack: rowError.stack
            } : rowError,
            employeeId: (row as any).Employee_ID
          });
          return null;
        }
      });
    
    convertedRows = mappedRows.filter((row): row is SalaryRecord => row !== null && row.Employee_ID !== null); // Filter out NULL Employee_IDs and failed transformations
    
    console.log('[FETCH_SALARIES] Data transformation completed', { 
      originalCount: rows.length,
      convertedCount: convertedRows.length 
    });
  } catch (error) {
    console.error('[FETCH_SALARIES] Data transformation error', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    throw error;
  }

  // Still use directory lookup for backward compatibility with old data
  let directoryLookup: DirectoryLookup;
  try {
    console.log('[FETCH_SALARIES] Fetching directory lookup');
    directoryLookup = await fetchDirectoryLookup();
    console.log('[FETCH_SALARIES] Directory lookup completed');
  } catch (error) {
    console.error('[FETCH_SALARIES] Directory lookup error', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    // Continue with empty lookup if directory fetch fails
    directoryLookup = { byEmail: new Map(), byId: new Map(), byKey: new Map() };
  }

  let enrichedRows: SalaryRecord[] = [];
  let filteredRows: SalaryRecord[] = [];
  try {
    enrichedRows = convertedRows.map((row) => enrichSalaryRow(row, directoryLookup));
    filteredRows = enrichedRows.filter((row) => shouldIncludeRow(row, filters.month));
    console.log('[FETCH_SALARIES] Enrichment and filtering completed', {
      enrichedCount: enrichedRows.length,
      filteredCount: filteredRows.length
    });
  } catch (error) {
    console.error('[FETCH_SALARIES] Enrichment/filtering error', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    });
    throw error;
  }

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
    console.log('[FETCH_DIRECTORY_LOOKUP] Using cached lookup');
    return directoryCache.lookup;
  }

  const queryStartTime = Date.now();
  console.log('[FETCH_DIRECTORY_LOOKUP] Starting query');
  
  try {
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
    const queryEndTime = Date.now();
    console.log('[FETCH_DIRECTORY_LOOKUP] Query completed', {
      duration: `${queryEndTime - queryStartTime}ms`,
      rowsCount: rows?.length ?? 0
    });

    const byEmail = new Map<string, DirectoryRecord>();
    const byId = new Map<string, DirectoryRecord>();
    const byKey = new Map<string, DirectoryRecord>();

    try {
      (rows as DirectoryRecord[]).forEach((row) => {
        try {
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
        } catch (rowError) {
          console.error('[FETCH_DIRECTORY_LOOKUP] Error processing row', {
            error: rowError instanceof Error ? {
              message: rowError.message,
              stack: rowError.stack
            } : rowError,
            employeeId: (row as any).Employee_ID
          });
        }
      });

      const lookup = { byEmail, byId, byKey };
      directoryCache = { lookup, fetchedAt: now };
      console.log('[FETCH_DIRECTORY_LOOKUP] Lookup created', {
        byEmailSize: byEmail.size,
        byIdSize: byId.size,
        byKeySize: byKey.size
      });
      return lookup;
    } catch (processingError) {
      console.error('[FETCH_DIRECTORY_LOOKUP] Error processing rows', {
        error: processingError instanceof Error ? {
          message: processingError.message,
          stack: processingError.stack,
          name: processingError.name
        } : processingError
      });
      throw processingError;
    }
  } catch (error) {
    const queryEndTime = Date.now();
    console.error('[FETCH_DIRECTORY_LOOKUP] Query error', {
      duration: `${queryEndTime - queryStartTime}ms`,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      employeeRef
    });
    throw error;
  }
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

export const shapeSalaryRow = (row: SalaryRecord) => {
  // Return the full row object to include all fields needed by the UI
  // This ensures Designation, Email, dates, calculated fields, etc. are all included
  return {
    ...row,
    // Ensure these critical fields are explicitly included
    Designation: row.Designation ?? null,
    Email: row.Email ?? null,
    Date_of_Joining: row.Date_of_Joining ?? null,
    Date_of_Leaving: row.Date_of_Leaving ?? null,
    Worked_Days: row.Worked_Days ?? null,
    Regular_Pay: row.Regular_Pay ?? null,
    Revised_with_OPD: row.Revised_with_OPD ?? null,
    Prorated_Pay: row.Prorated_Pay ?? null,
    Performance_Bonus: row.Performance_Bonus ?? null,
    Paid_Overtime: row.Paid_Overtime ?? null,
    Reimbursements: row.Reimbursements ?? null,
    Other: row.Other ?? null,
    Last_Month_Salary: row.Last_Month_Salary ?? null,
    New_Addition_Increment_Decrement: row.New_Addition_Increment_Decrement ?? null,
    Date_of_Increment_Decrement: row.Date_of_Increment_Decrement ?? null,
    Payable_from_Last_Month: row.Payable_from_Last_Month ?? null,
    Unpaid_Leaves: row.Unpaid_Leaves ?? null,
    Deductions: row.Deductions ?? null,
    Comments: row.Comments ?? null,
    Internal_Comments: row.Internal_Comments ?? null,
    Salary_Status: row.Salary_Status ?? null,
    PaySlip_Status: row.PaySlip_Status ?? null,
  };
};
