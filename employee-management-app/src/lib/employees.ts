import 'server-only';
import { getBigQueryClient } from "./bigquery";
import { fetchOffboardingRecord } from "./offboarding";
import type {
  EmployeeFilters,
  EmployeeRecord,
  EmploymentStatus,
  SalaryRecord,
  EobiRecord,
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
const tableId = BQ_TABLE;
const auditTable = BQ_AUDIT_TABLE ?? undefined;
const salaryTable = BQ_SALARY_TABLE ?? "EmployeeSalaries_v1";
const eobiTable = BQ_EOBI_TABLE ?? "EmployeeEOBI_v1";
const historyTable = BQ_HISTORY_TABLE ?? "EmployeeDirectoryHistory_v1";
const offboardingTable = BQ_OFFBOARDING_TABLE ?? "EmployeeOffboarding_v1";

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
      LOWER(base.Employee_ID) LIKE @search OR
      LOWER(base.Full_Name) LIKE @search OR
      LOWER(base.Official_Email) LIKE @search
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
      SAFE.PARSE_DATE('%Y-%m-%d', base.Joining_Date_ISO) DESC,
      SAFE.PARSE_DATE('%Y-%m-%d', base.Employment_End_Date_ISO) DESC,
      base.Joining_Date DESC
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

  const query = `
    SELECT *
    FROM ${tableRef}
    WHERE Employee_ID = @employeeId
    LIMIT 1
  `;

  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });

  return (rows[0] as EmployeeRecord) ?? null;
}

export async function fetchLatestSalaryByEmployee(employeeId: string): Promise<SalaryRecord | null> {
  if (!salaryTableRef) return null;
  const bigquery = getBigQueryClient();
  const query = `
    SELECT *
    FROM ${salaryTableRef}
    WHERE Employee_ID = @employeeId
    ORDER BY Payroll_Month DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });
  return (rows[0] as SalaryRecord) ?? null;
}

export async function fetchLatestEobiByEmployee(employeeId: string): Promise<EobiRecord | null> {
  if (!eobiTableRef) return null;
  const bigquery = getBigQueryClient();
  const query = `
    SELECT *
    FROM ${eobiTableRef}
    WHERE Employee_ID = @employeeId
    ORDER BY Payroll_Month DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
  });
  return (rows[0] as EobiRecord) ?? null;
}

export async function fetchEmployeeHistory(employeeId: string): Promise<EmployeeHistoryRecord[]> {
  if (!historyTableRef) return [];
  const bigquery = getBigQueryClient();
  const query = `
    SELECT *
    FROM ${historyTableRef}
    WHERE Employee_ID = @employeeId
    ORDER BY Rejoin_Sequence DESC
  `;
  const [rows] = await bigquery.query({
    query,
    params: { employeeId },
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
  const query = `
    UPDATE ${tableRef}
    SET Employment_Status = @status,
        Employment_End_Date = @endDate
    WHERE Employee_ID = @employeeId
  `;

  await bigquery.query({
    query,
    params: {
      employeeId,
      status,
      endDate: endDate ?? null,
    },
    types: {
      employeeId: 'STRING',
      status: 'STRING',
      endDate: 'STRING',
    },
  });

  if (auditTableRef) {
    try {
      await bigquery
        .dataset(datasetId)
        .table(auditTable!)
        .insert([
          {
            Employee_ID: employeeId,
            Field_Name: 'Employment_Status',
            Old_Value: null,
            New_Value: status,
            Reason: reason ?? null,
            Changed_By: updatedBy ?? 'dashboard@vyro.ai',
            Changed_At: new Date().toISOString(),
          },
        ]);
    } catch (error) {
      console.warn("[EMPLOYEE_AUDIT_ERROR]", error);
    }
  }

  return fetchEmployeeById(employeeId);
}

export async function fetchEmployeeFull(employeeId: string) {
  const [profile, salary, eobi, history, offboarding] = await Promise.all([
    fetchEmployeeById(employeeId),
    fetchLatestSalaryByEmployee(employeeId),
    fetchLatestEobiByEmployee(employeeId),
    fetchEmployeeHistory(employeeId),
    offboardingTableRef ? fetchOffboardingRecord(employeeId) : Promise.resolve(null),
  ]);

  if (!profile) {
    return { profile: null, salary, eobi, history, offboarding: offboarding as EmployeeOffboardingRecord | null };
  }

  return { profile, salary, eobi, history, offboarding: offboarding as EmployeeOffboardingRecord | null };
}

export async function updateEmploymentEndDate(employeeId: string, endDate?: string | null) {
  const bigquery = getBigQueryClient();
  const query = `
    UPDATE ${tableRef}
    SET Employment_End_Date = @endDate
    WHERE Employee_ID = @employeeId
  `;
  await bigquery.query({
    query,
    params: {
      employeeId,
      endDate: endDate ?? null,
    },
    types: {
      employeeId: 'STRING',
      endDate: 'STRING',
    },
  });
}

