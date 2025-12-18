import 'server-only';
import { getBigQueryClient } from "./bigquery";
import { fetchOffboardingRecord } from "./offboarding";
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
    conditions.push(`(
      CAST(base.Employee_ID AS STRING) LIKE @search OR
      LOWER(base.Full_Name) LIKE @search OR
      LOWER(base.Official_Email) LIKE @search OR
      LOWER(base.Personal_Email) LIKE @search
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT base.*, off.Offboarding_Status, off.Employment_End_Date AS Offboarding_Date, off.Employment_End_Date_ISO AS Offboarding_Date_ISO, off.Note AS Offboarding_Note
    FROM ${tableRef} base
    ${
      offboardingTableRef
        ? `LEFT JOIN ${offboardingTableRef} off ON base.Employee_ID = off.Employee_ID`
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
    params.search = `%${filters.search.toLowerCase()}%`;
  }

  const [rows] = await bigquery.query({
    query,
    params,
  });

  return rows as EmployeeRecord[];
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

  return (rows[0] as EmployeeRecord) ?? null;
}

export async function fetchLatestSalaryByEmployee(employeeId: string): Promise<SalaryRecord | null> {
  if (!salaryTableRef) return null;
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
      e.Department
    FROM ${salaryTableRef} s
    LEFT JOIN ${tableRef} e ON s.Employee_ID = e.Employee_ID
    WHERE s.Employee_ID = @employeeId
    ORDER BY s.Payroll_Month DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });
  return (rows[0] as SalaryRecord) ?? null;
}

export async function fetchLatestEobiByEmployee(employeeId: string): Promise<EOBIRecord | null> {
  if (!eobiTableRef) return null;
  const bigquery = getBigQueryClient();
  
  // Convert string from URL to number (INT64)
  const employeeIdNum = parseInt(employeeId, 10);
  if (isNaN(employeeIdNum)) {
    return null;
  }
  
  const query = `
    SELECT *
    FROM ${eobiTableRef}
    WHERE Employee_ID = @employeeId
    ORDER BY Payroll_Month DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });
  return (rows[0] as EOBIRecord) ?? null;
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
    WHERE Employee_ID = @employeeId
    ORDER BY Rejoin_Sequence DESC
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId: employeeIdNum },
  });
  return rows as EmployeeHistoryRecord[];
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
  
  const [profile, salary, eobi, history, offboarding, opd, tax] = await Promise.all([
    fetchEmployeeById(employeeId),
    fetchLatestSalaryByEmployee(employeeId),
    fetchLatestEobiByEmployee(employeeId),
    fetchEmployeeHistory(employeeId),
    offboardingTableRef ? fetchOffboardingRecord(employeeId) : Promise.resolve(null),
    // Fetch OPD benefits
    (async () => {
      const bigquery = getBigQueryClient();
      try {
        const query = `
          SELECT *
          FROM ${opdTableRef}
          WHERE Employee_ID = @employeeId
          ORDER BY Benefit_Month DESC
          LIMIT 12
        `;
        const [rows] = await bigquery.query({ query, params: { employeeId: employeeIdNum } });
        return rows;
      } catch (e) {
        console.warn("[FETCH_OPD_ERROR]", e);
        return null;
      }
    })(),
    // Fetch Tax calculations
    (async () => {
      const bigquery = getBigQueryClient();
      try {
        const query = `
          SELECT *
          FROM ${taxTableRef}
          WHERE Employee_ID = @employeeId
          ORDER BY Payroll_Month DESC
          LIMIT 12
        `;
        const [rows] = await bigquery.query({ query, params: { employeeId: employeeIdNum } });
        return rows;
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
      eobi, 
      history, 
      offboarding: offboarding as EmployeeOffboardingRecord | null,
      opd: opd as any,
      tax: tax as any,
    };
  }

  return { 
    profile, 
    salary, 
    eobi, 
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

