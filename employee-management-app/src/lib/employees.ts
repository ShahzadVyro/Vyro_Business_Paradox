import 'server-only';
import { getBigQueryClient } from "./bigquery";
import { fetchOffboardingRecord } from "./offboarding";
import { convertDateToString } from "./formatters";
import type {
  EmployeeFilters,
  EmployeeRecord,
  EmploymentStatus,
  SalaryRecord,
  EOBIRecord,
  EmployeeHistoryRecord,
  EmployeeOffboardingRecord,
} from "@/types/employee";

const {
  BQ_DATASET,
  BQ_TABLE,
  BQ_AUDIT_TABLE,
  BQ_SALARY_TABLE,
  BQ_EOBI_TABLE,
  BQ_HISTORY_TABLE,
  BQ_OFFBOARDING_TABLE,
} = process.env;

if (!BQ_DATASET || !BQ_TABLE) {
  throw new Error("Missing BigQuery dataset/table configuration");
}

const datasetId = BQ_DATASET;
const tableId = BQ_TABLE ?? "Employees"; // Default to new unified table
const employeeRef = `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${tableId}\``;
const auditTable = BQ_AUDIT_TABLE ?? "Employee_Field_Updates";
const salaryTable = BQ_SALARY_TABLE ?? "Employee_Salaries";
const eobiTable = BQ_EOBI_TABLE ?? "Employee_EOBI";
const historyTable = BQ_HISTORY_TABLE ?? "EmployeeDirectoryHistory_v1";
const offboardingTable = BQ_OFFBOARDING_TABLE ?? "EmployeeOffboarding_v1";
const opdTable = process.env.BQ_OPD_TABLE ?? "Employee_OPD_Benefits";
const taxTable = process.env.BQ_TAX_TABLE ?? "Employee_Tax_Calculations";

const tableRef = `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${tableId}\``;
const auditTableRef = auditTable ? `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${auditTable}\`` : null;
const salaryTableRef = salaryTable
  ? `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${salaryTable}\``
  : null;
const eobiTableRef = eobiTable
  ? `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${eobiTable}\``
  : null;
const historyTableRef = historyTable
  ? `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${historyTable}\``
  : null;
const offboardingTableRef = offboardingTable
  ? `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${offboardingTable}\``
  : null;
const opdTableRef = `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${opdTable}\``;
const taxTableRef = `\`${process.env.GCP_PROJECT_ID}.${datasetId}.${taxTable}\``;

/**
 * Normalizes date fields in an employee record to strings (YYYY-MM-DD format).
 * This ensures dates are properly serialized in API responses.
 */
function normalizeEmployeeDates(employee: EmployeeRecord): EmployeeRecord {
  // Normalize all date fields to strings (YYYY-MM-DD format)
  // Note: Created_At and Updated_At are returned from BigQuery but not in EmployeeRecord type
  const employeeAny = employee as any;
  
  // Prioritize Employment_End_Date from Employees table, fallback to Offboarding_Date if NULL
  let employmentEndDate = employee.Employment_End_Date;
  if (!employmentEndDate && employeeAny.Offboarding_Date) {
    employmentEndDate = employeeAny.Offboarding_Date;
  }
  
  return {
    ...employee,
    Joining_Date: convertDateToString(employee.Joining_Date) ?? null,
    Date_of_Birth: employee.Date_of_Birth ? convertDateToString(employee.Date_of_Birth) ?? null : null,
    Probation_End_Date: employee.Probation_End_Date ? convertDateToString(employee.Probation_End_Date) ?? null : null,
    Employment_End_Date: employmentEndDate ? convertDateToString(employmentEndDate) ?? null : null,
    Spouse_DOB: employee.Spouse_DOB ? convertDateToString(employee.Spouse_DOB) ?? null : null,
    // Normalize timestamp fields that may be present in BigQuery results
    Created_At: employeeAny.Created_At ? convertDateToString(employeeAny.Created_At) ?? null : null,
    Updated_At: employeeAny.Updated_At ? convertDateToString(employeeAny.Updated_At) ?? null : null,
    Loaded_At: employeeAny.Loaded_At ? convertDateToString(employeeAny.Loaded_At) ?? null : null,
  } as EmployeeRecord;
}

export async function fetchEmployees(filters: EmployeeFilters): Promise<EmployeeRecord[]> {
  const bigquery = getBigQueryClient();
  const conditions: string[] = [];

  if (filters.status) {
    conditions.push('base.Employment_Status = @status');
  }
  if (filters.department) {
    conditions.push('base.Department = @department');
  }
  if (filters.search) {
    // Normalize search term: trim and convert to lowercase for LIKE matching
    const searchTerm = filters.search.trim().toLowerCase();
    conditions.push(`(
      CAST(base.Employee_ID AS STRING) LIKE @search OR
      LOWER(TRIM(base.Full_Name)) LIKE @search OR
      LOWER(TRIM(COALESCE(base.Official_Email, ''))) LIKE @search OR
      LOWER(TRIM(COALESCE(base.Personal_Email, ''))) LIKE @search
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT base.*, off.Offboarding_Status, off.Employment_End_Date AS Offboarding_Date, off.Employment_End_Date_ISO AS Offboarding_Date_ISO, off.Note AS Offboarding_Note
    FROM ${tableRef} base
    ${
      offboardingTableRef
        ? `LEFT JOIN ${offboardingTableRef} off ON CAST(base.Employee_ID AS STRING) = off.Employee_ID`
        : `LEFT JOIN (
            SELECT NULL AS Employee_ID,
                   NULL AS Offboarding_Status,
                   NULL AS Employment_End_Date,
                   NULL AS Employment_End_Date_ISO,
                   NULL AS Note
          ) off ON 1=0`
    }
    ${whereClause}
    ORDER BY
      base.Joining_Date DESC NULLS LAST,
      base.Employment_End_Date DESC NULLS LAST,
      base.Full_Name ASC
    LIMIT @limit OFFSET @offset
  `;

  const params: Record<string, unknown> = {
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
  if (filters.status) {
    params.status = filters.status;
  }
  if (filters.department) {
    params.department = filters.department;
  }
  if (filters.search) {
    // Normalize search term: trim whitespace and wrap with wildcards
    const searchTerm = filters.search.trim().toLowerCase();
    params.search = `%${searchTerm}%`;
  }

  const [rows] = await bigquery.query({
    query,
    params,
  });

  // Convert Employee_ID from string to number and normalize dates
  return (rows as EmployeeRecord[]).map((row) => {
    const normalized = {
      ...row,
      Employee_ID: typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID,
    };
    return normalizeEmployeeDates(normalized);
  });
}

export async function fetchEmployeeById(employeeId: string): Promise<EmployeeRecord | null> {
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    return null;
  }

  const query = `
    SELECT *
    FROM ${tableRef}
    WHERE Employee_ID = @employeeId
    LIMIT 1
  `;

  const [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });

  const row = rows[0] as EmployeeRecord | undefined;
  if (!row) return null;

  // Diagnostic logging for Employment_End_Date
  if (employeeIdNum === 5473 || (row as any).Employment_End_Date) {
    console.log(`[EMPLOYEE_5473_DEBUG] Raw Employment_End_Date from BigQuery:`, {
      value: (row as any).Employment_End_Date,
      type: typeof (row as any).Employment_End_Date,
      constructor: (row as any).Employment_End_Date?.constructor?.name,
      keys: typeof (row as any).Employment_End_Date === 'object' ? Object.keys((row as any).Employment_End_Date || {}) : null,
    });
  }

  // Convert Employee_ID from string to number and normalize dates
  const normalized = {
    ...row,
    Employee_ID: typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID,
  };
  const result = normalizeEmployeeDates(normalized);
  
  // Diagnostic logging after normalization
  if (employeeIdNum === 5473 || result.Employment_End_Date) {
    console.log(`[EMPLOYEE_5473_DEBUG] Normalized Employment_End_Date:`, {
      value: result.Employment_End_Date,
      type: typeof result.Employment_End_Date,
    });
  }
  
  return result;
}

export async function fetchLatestSalaryByEmployee(employeeId: string): Promise<SalaryRecord | null> {
  if (!salaryTableRef) return null;
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    return null;
  }

  // Try querying with INT64 cast first (most common case)
  let query = `
    SELECT 
      s.*,
      e.Full_Name AS Employee_Name,
      e.Official_Email,
      e.Personal_Email,
      e.Designation,
      e.Department
    FROM ${salaryTableRef} s
    LEFT JOIN ${tableRef} e ON SAFE_CAST(s.Employee_ID AS INT64) = e.Employee_ID
    WHERE SAFE_CAST(s.Employee_ID AS INT64) = @employeeId
    ORDER BY s.Payroll_Month DESC
    LIMIT 1
  `;
  
  let [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });

  // If no results, try querying with Employee_ID as string (fallback for type mismatches)
  if (rows.length === 0) {
    query = `
      SELECT 
        s.*,
        e.Full_Name AS Employee_Name,
        e.Official_Email,
        e.Personal_Email,
        e.Designation,
        e.Department
      FROM ${salaryTableRef} s
      LEFT JOIN ${tableRef} e ON CAST(s.Employee_ID AS STRING) = CAST(e.Employee_ID AS STRING)
      WHERE CAST(s.Employee_ID AS STRING) = @employeeIdStr
      ORDER BY s.Payroll_Month DESC
      LIMIT 1
    `;
    [rows] = await bigquery.query({
      query,
      params: { employeeIdStr: String(employeeIdNum) },
    });
  }

  // Diagnostic logging for employee 5473
  if (employeeIdNum === 5473) {
    console.log(`[EMPLOYEE_5473_DEBUG] Salary query results:`, {
      rowCount: rows.length,
      hasData: rows.length > 0,
      firstRow: rows[0] ? {
        keys: Object.keys(rows[0] as object),
        employeeId: (rows[0] as any)?.Employee_ID,
        employeeIdType: typeof (rows[0] as any)?.Employee_ID,
      } : null,
      employeeId: employeeIdNum,
      salaryTableRef,
      queryUsed: rows.length > 0 ? 'found' : 'none',
    });
  }

  const row = rows[0] as SalaryRecord | undefined;
  if (!row) {
    // Diagnostic logging when no salary found
    if (employeeIdNum === 5473) {
      console.log(`[EMPLOYEE_5473_DEBUG] No salary record found for employee ${employeeIdNum} after trying both INT64 and STRING queries`);
    }
    return null;
  }
  
  // Convert Employee_ID from string to number and normalize ALL date fields
  const normalized = {
    ...row,
    Employee_ID: row.Employee_ID !== null && row.Employee_ID !== undefined
      ? (typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID)
      : null,
    Payroll_Month: convertDateToString(row.Payroll_Month) ?? null,
    Loaded_At: row.Loaded_At ? convertDateToString(row.Loaded_At) ?? null : null,
    Created_At: (row as any).Created_At ? convertDateToString((row as any).Created_At) ?? null : null,
    Updated_At: (row as any).Updated_At ? convertDateToString((row as any).Updated_At) ?? null : null,
    Joining_Date: row.Joining_Date ? convertDateToString(row.Joining_Date) ?? null : null,
    Date_of_Birth: row.Date_of_Birth ? convertDateToString(row.Date_of_Birth) ?? null : null,
    Spouse_DOB: row.Spouse_DOB ? convertDateToString(row.Spouse_DOB) ?? null : null,
    Probation_End_Date: row.Probation_End_Date ? convertDateToString(row.Probation_End_Date) ?? null : null,
    Employment_End_Date: row.Employment_End_Date ? convertDateToString(row.Employment_End_Date) ?? null : null,
    Date_of_Increment: row.Date_of_Increment ? convertDateToString(row.Date_of_Increment) ?? null : null,
    Payable_From: row.Payable_From ? convertDateToString(row.Payable_From) ?? null : null,
    Salary_Effective_Date: row.Salary_Effective_Date ? convertDateToString(row.Salary_Effective_Date) ?? null : null,
  };
  
  return normalized;
}

export async function fetchEobiByEmployee(employeeId: string): Promise<EOBIRecord[]> {
  if (!eobiTableRef) return [];
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    return [];
  }

  // Fetch all EOBI records for this employee, ordered by month
  let query = `
    SELECT 
      eobi.*,
      e.Full_Name AS NAME,
      e.CNIC_ID AS CNIC,
      e.EOBI_Number
    FROM ${eobiTableRef} eobi
    LEFT JOIN ${employeeRef} e ON SAFE_CAST(eobi.Employee_ID AS INT64) = SAFE_CAST(e.Employee_ID AS INT64)
    WHERE SAFE_CAST(eobi.Employee_ID AS INT64) = @employeeId
    ORDER BY eobi.Payroll_Month DESC
  `;
  
  let [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });
  
  if (!rows || rows.length === 0) {
    return [];
  }

  // Normalize dates
  const normalizedRows = (rows as EOBIRecord[]).map((row) => {
    return {
      ...row,
      Payroll_Month: convertDateToString(row.Payroll_Month) ?? null,
      From_Date: convertDateToString(row.From_Date) ?? null,
      To_Date: convertDateToString(row.To_Date) ?? null,
      DOJ: row.DOJ ? convertDateToString(row.DOJ) ?? null : null,
      DOB: row.DOB ? convertDateToString(row.DOB) ?? null : null,
      Loaded_At: row.Loaded_At ? convertDateToString(row.Loaded_At) ?? null : null,
    };
  });
  
  return normalizedRows;
}

export async function fetchLatestEobiByEmployee(employeeId: string): Promise<EOBIRecord | null> {
  const records = await fetchEobiByEmployee(employeeId);
  return records.length > 0 ? records[0] : null;
}

export async function fetchEmployeeHistory(employeeId: string): Promise<EmployeeHistoryRecord[]> {
  if (!historyTableRef) return [];
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    return [];
  }
  
  const query = `
    SELECT *
    FROM ${historyTableRef}
    WHERE SAFE_CAST(Employee_ID AS INT64) = @employeeId
    ORDER BY Rejoin_Sequence DESC
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });
  
  // Convert Employee_ID from string to number and normalize dates
  return (rows as EmployeeHistoryRecord[]).map((row) => {
    const normalized = {
      ...row,
      Employee_ID: typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID,
      Joining_Date: convertDateToString(row.Joining_Date) ?? null,
      Employment_End_Date: row.Employment_End_Date ? convertDateToString(row.Employment_End_Date) ?? null : null,
    };
    
    return normalized;
  });
}

export async function updateEmploymentStatus(
  employeeId: string,
  status: EmploymentStatus,
  {
    reason,
    endDate,
    updatedBy,
  }: { reason?: string | null; endDate?: string | null; updatedBy?: string | null }
) {
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    throw new Error(`Invalid Employee_ID: ${employeeId}`);
  }
  
  const query = `
    UPDATE ${tableRef}
    SET Employment_Status = @status,
        Employment_End_Date = @endDate,
        Updated_At = CURRENT_TIMESTAMP()
    WHERE Employee_ID = @employeeId
  `;

  await bigquery.query({
    query,
    params: {
      employeeId: employeeIdNum,
      status,
      endDate: endDate ?? null,
    },
  });

  if (auditTableRef) {
    try {
      const auditQuery = `
        INSERT INTO ${auditTableRef}
          (Employee_ID, Field_Name, Old_Value, New_Value, Updated_Date, Updated_By, Reason)
        VALUES
          (@employeeId, 'Employment_Status', @oldValue, @newValue, CURRENT_TIMESTAMP(), @updatedBy, @reason)
      `;
      await bigquery.query({
        query: auditQuery,
        params: {
          employeeId: employeeIdNum,
          oldValue: null,
          newValue: status,
          updatedBy: updatedBy ?? 'dashboard@vyro.ai',
          reason: reason ?? null,
        },
      });
    } catch (error) {
      console.warn("[EMPLOYEE_AUDIT_ERROR]", error);
    }
  }

  return fetchEmployeeById(employeeId);
}

export async function fetchEmployeeFull(employeeId: string) {
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    return { profile: null, salary: null, eobi: null, history: [], offboarding: null, opd: null, tax: null };
  }
  
  const [profile, salary, eobiRecords, history, offboarding, opd, tax] = await Promise.all([
    fetchEmployeeById(employeeId),
    fetchLatestSalaryByEmployee(employeeId),
    fetchEobiByEmployee(employeeId),
    fetchEmployeeHistory(employeeId),
    offboardingTableRef ? fetchOffboardingRecord(employeeId) : Promise.resolve(null),
    // Fetch OPD benefits
    (async () => {
      const bigquery = getBigQueryClient();
      try {
        // Try INT64 first
        let query = `
          SELECT *
          FROM ${opdTableRef}
          WHERE SAFE_CAST(Employee_ID AS INT64) = @employeeId
          ORDER BY Benefit_Month DESC
          LIMIT 12
        `;
        let [rows] = await bigquery.query({ query, params: { employeeId: employeeIdNum } });
        
        // Fallback to STRING if no results
        if (rows.length === 0) {
          query = `
            SELECT *
            FROM ${opdTableRef}
            WHERE CAST(Employee_ID AS STRING) = @employeeIdStr
            ORDER BY Benefit_Month DESC
            LIMIT 12
          `;
          [rows] = await bigquery.query({ query, params: { employeeIdStr: String(employeeIdNum) } });
        }
        // Convert Employee_ID from string to number and normalize dates
        return (rows as any[]).map((row) => {
          const normalized = {
            ...row,
            Employee_ID: row.Employee_ID !== null && row.Employee_ID !== undefined
              ? (typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID)
              : null,
            Benefit_Month: convertDateToString(row.Benefit_Month) ?? null,
            Last_Contribution_Month: row.Last_Contribution_Month ? convertDateToString(row.Last_Contribution_Month) ?? null : null,
            Last_Claim_Month: row.Last_Claim_Month ? convertDateToString(row.Last_Claim_Month) ?? null : null,
            Created_At: row.Created_At ? convertDateToString(row.Created_At) ?? null : null,
            Updated_At: row.Updated_At ? convertDateToString(row.Updated_At) ?? null : null,
          };
          
          return normalized;
        });
      } catch (e) {
        console.warn("[FETCH_OPD_ERROR]", e);
        return null;
      }
    })(),
    // Fetch Tax calculations
    (async () => {
      const bigquery = getBigQueryClient();
      try {
        // Try INT64 first
        let query = `
          SELECT *
          FROM ${taxTableRef}
          WHERE SAFE_CAST(Employee_ID AS INT64) = @employeeId
          ORDER BY Payroll_Month DESC
          LIMIT 12
        `;
        let [rows] = await bigquery.query({ query, params: { employeeId: employeeIdNum } });
        
        // Fallback to STRING if no results
        if (rows.length === 0) {
          query = `
            SELECT *
            FROM ${taxTableRef}
            WHERE CAST(Employee_ID AS STRING) = @employeeIdStr
            ORDER BY Payroll_Month DESC
            LIMIT 12
          `;
          [rows] = await bigquery.query({ query, params: { employeeIdStr: String(employeeIdNum) } });
        }
        // Convert Employee_ID from string to number and normalize dates
        return (rows as any[]).map((row) => {
          const normalized = {
            ...row,
            Employee_ID: row.Employee_ID !== null && row.Employee_ID !== undefined
              ? (typeof row.Employee_ID === 'string' ? parseInt(row.Employee_ID, 10) : row.Employee_ID)
              : null,
            Payroll_Month: convertDateToString(row.Payroll_Month) ?? null,
            Calculated_At: row.Calculated_At ? convertDateToString(row.Calculated_At) ?? null : null,
            Created_At: row.Created_At ? convertDateToString(row.Created_At) ?? null : null,
          };
          
          return normalized;
        });
      } catch (e) {
        console.warn("[FETCH_TAX_ERROR]", e);
        return null;
      }
    })(),
  ]);

  if (!profile) {
    return { 
      profile: null, 
      salary, 
      eobi: eobiRecords, 
      history, 
      offboarding: offboarding as EmployeeOffboardingRecord | null,
      opd: opd as any,
      tax: tax as any,
    };
  }

  return { 
    profile, 
    salary, 
    eobi: eobiRecords, 
    history, 
    offboarding: offboarding as EmployeeOffboardingRecord | null,
    opd: opd as any,
    tax: tax as any,
  };
}

export async function updateEmploymentEndDate(employeeId: string, endDate?: string | null) {
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    throw new Error(`Invalid Employee_ID: ${employeeId}`);
  }
  
  const query = `
    UPDATE ${tableRef}
    SET Employment_End_Date = @endDate,
        Updated_At = CURRENT_TIMESTAMP()
    WHERE Employee_ID = @employeeId
  `;
  await bigquery.query({
    query,
    params: {
      employeeId: employeeIdNum,
      endDate: endDate ?? null,
    },
  });
}

