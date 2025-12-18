import "server-only";
import { getBigQueryClient } from "@/lib/bigquery";
import { fetchEobiSummary, fetchPayrollSummary, fetchSalaryMonths } from "@/lib/payroll";
import type { DashboardSummary } from "@/types/payroll";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;
const employeeTable = process.env.BQ_TABLE;

if (!projectId || !dataset || !employeeTable) {
  throw new Error("Missing BigQuery configuration for dashboard summary");
}

const employeeTableRef = `\`${projectId}.${dataset}.${employeeTable}\``;

// Validate table configuration
const validateTableConfig = async () => {
  if (!employeeTable || employeeTable === "EmployeeData_v2") {
    console.warn(
      `[DASHBOARD] WARNING: BQ_TABLE is set to "${employeeTable}". ` +
      `Expected "Employees" table. This might query the wrong table.`
    );
  }

  // Try to verify table exists by checking row count
  try {
    const bigquery = getBigQueryClient();
    const checkQuery = `
      SELECT COUNT(*) as row_count
      FROM ${employeeTableRef}
      LIMIT 1
    `;
    const [rows] = await bigquery.query({ query: checkQuery });
    const rowCount = Number((rows[0] as { row_count: number })?.row_count ?? 0);
    console.log(`[DASHBOARD] Table exists with ${rowCount} total rows`);
    
    // Check for distinct Employee_IDs
    const distinctQuery = `
      SELECT COUNT(DISTINCT Employee_ID) as distinct_ids
      FROM ${employeeTableRef}
      WHERE Employee_ID IS NOT NULL
    `;
    const [distinctRows] = await bigquery.query({ query: distinctQuery });
    const distinctCount = Number((distinctRows[0] as { distinct_ids: number })?.distinct_ids ?? 0);
    console.log(`[DASHBOARD] Table has ${distinctCount} distinct Employee_IDs`);
    
    if (rowCount > distinctCount) {
      console.warn(
        `[DASHBOARD] WARNING: Table has ${rowCount} rows but only ${distinctCount} distinct Employee_IDs. ` +
        `This indicates duplicate records. Using COUNT(DISTINCT Employee_ID) will give accurate counts.`
      );
    }
  } catch (error) {
    console.error(`[DASHBOARD] ERROR: Could not validate table ${employeeTableRef}:`, error);
    throw new Error(`Table ${employeeTableRef} does not exist or is not accessible`);
  }
};

const fetchEmployeeCounts = async () => {
  const bigquery = getBigQueryClient();
  
  // Log which table is being queried for diagnostics
  console.log(`[DASHBOARD] Querying employee table: ${employeeTableRef}`);
  
  // Use COUNT(DISTINCT Employee_ID) to count unique employees, not all rows
  // Handle status variations: case-insensitive matching and handle "Resigned", "Terminated" separately
  const query = `
    SELECT
      COUNT(DISTINCT Employee_ID) AS total,
      COUNT(DISTINCT CASE 
        WHEN UPPER(TRIM(Employment_Status)) = 'ACTIVE' 
        THEN Employee_ID 
      END) AS active,
      COUNT(DISTINCT CASE 
        WHEN UPPER(TRIM(Employment_Status)) IN ('RESIGNED/TERMINATED', 'RESIGNED', 'TERMINATED')
        THEN Employee_ID 
      END) AS resigned
    FROM ${employeeTableRef}
    WHERE Employee_ID IS NOT NULL
  `;
  
  const [rows] = await bigquery.query({ query });
  const row = rows[0] as { total: number; active: number; resigned: number };
  
  const counts = {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    resigned: Number(row?.resigned ?? 0),
  };
  
  // Diagnostic logging
  console.log(`[DASHBOARD] Employee counts:`, counts);
  
  // Also check for status value distribution for debugging
  const diagnosticQuery = `
    SELECT
      UPPER(TRIM(Employment_Status)) AS normalized_status,
      COUNT(DISTINCT Employee_ID) AS count
    FROM ${employeeTableRef}
    WHERE Employee_ID IS NOT NULL
    GROUP BY normalized_status
    ORDER BY count DESC
  `;
  
  try {
    const [diagnosticRows] = await bigquery.query({ query: diagnosticQuery });
    console.log(`[DASHBOARD] Status distribution:`, diagnosticRows);
  } catch (error) {
    console.warn(`[DASHBOARD] Could not fetch status distribution:`, error);
  }
  
  return counts;
};

export const getDashboardSummary = async (requestedMonth?: string): Promise<DashboardSummary> => {
  // Log table configuration for diagnostics
  console.log(`[DASHBOARD] Configuration:`, {
    projectId,
    dataset,
    employeeTable,
    fullTableRef: employeeTableRef,
  });

  // Validate table configuration and existence
  await validateTableConfig();

  const months = await fetchSalaryMonths();
  const activeMonth = requestedMonth ?? months[0]?.value;
  const monthLabel = months.find((month) => month.value === activeMonth)?.label;

  const [employees, payroll, eobi] = await Promise.all([
    fetchEmployeeCounts(),
    activeMonth ? fetchPayrollSummary(activeMonth) : Promise.resolve([]),
    activeMonth ? fetchEobiSummary(activeMonth) : Promise.resolve({ headcount: 0, employeeContribution: 0, employerContribution: 0, totalContribution: 0 }),
  ]);

  // Log final summary for diagnostics
  console.log(`[DASHBOARD] Summary generated:`, {
    employees,
    payrollMonth: activeMonth,
    payrollTotals: payroll.length,
    eobiHeadcount: eobi.headcount,
  });

  return {
    employees,
    payroll: {
      month: activeMonth,
      monthLabel,
      totals: payroll,
    },
    eobi,
    months,
  };
};


