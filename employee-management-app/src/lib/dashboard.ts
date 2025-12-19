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
  const incorrectTableNames = [
    "EmployeeData_v2",
    "EmployeeDirectoryLatest_v1",
    "EmployeeDirectory_v1",
    "EmployeeData",
  ];
  
  if (!employeeTable || incorrectTableNames.includes(employeeTable)) {
    console.warn(
      `[DASHBOARD] WARNING: BQ_TABLE is set to "${employeeTable}". ` +
      `Expected "Employees" table (the migrated table). This might query the wrong table. ` +
      `Please update your .env.local file to set BQ_TABLE=Employees`
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

const fetchNewJoinersThisMonth = async () => {
  const bigquery = getBigQueryClient();
  
  const query = `
    SELECT COUNT(DISTINCT Employee_ID) as new_joiners
    FROM ${employeeTableRef}
    WHERE DATE_TRUNC(CAST(Joining_Date AS DATE), MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
    AND UPPER(TRIM(Employment_Status)) = 'ACTIVE'
    AND Employee_ID IS NOT NULL
  `;
  
  const [rows] = await bigquery.query({ query });
  const count = Number((rows[0] as { new_joiners: number })?.new_joiners ?? 0);
  
  return count;
};

const fetchProbationsEndingSoon = async () => {
  console.log('[DASHBOARD] fetchProbationsEndingSoon - Starting query');
  console.log('[DASHBOARD] fetchProbationsEndingSoon - Table:', employeeTableRef);
  try {
    const bigquery = getBigQueryClient();
    
    const query = `
      SELECT 
        Employee_ID,
        Full_Name,
        Department,
        Probation_End_Date,
        DATE_DIFF(CAST(Probation_End_Date AS DATE), CURRENT_DATE(), DAY) as days_remaining
      FROM ${employeeTableRef}
      WHERE UPPER(TRIM(Employment_Status)) = 'ACTIVE'
      AND Probation_End_Date IS NOT NULL
      AND CAST(Probation_End_Date AS DATE) BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)
      AND Employee_ID IS NOT NULL
      ORDER BY Probation_End_Date ASC
      LIMIT 20
    `;
    
    console.log('[DASHBOARD] fetchProbationsEndingSoon - Executing query');
    const [rows] = await bigquery.query({ query });
    const results = (rows as any[]).map((row) => ({
      Employee_ID: Number(row.Employee_ID),
      Full_Name: row.Full_Name ?? '',
      Department: row.Department ?? null,
      Probation_End_Date: row.Probation_End_Date ? String(row.Probation_End_Date).split('T')[0] : '',
      daysRemaining: Number(row.days_remaining ?? 0),
    }));
    console.log('[DASHBOARD] fetchProbationsEndingSoon - Query succeeded, results:', results.length);
    if (results.length === 0) {
      console.log('[DASHBOARD] fetchProbationsEndingSoon - No probations ending soon (this is normal if none match criteria)');
    }
    return results;
  } catch (error) {
    console.error('[DASHBOARD] fetchProbationsEndingSoon - Query failed:', {
      error: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      table: employeeTableRef,
    });
    return [];
  }
};

const fetchDepartmentBreakdown = async () => {
  console.log('[DASHBOARD] fetchDepartmentBreakdown - Starting query');
  console.log('[DASHBOARD] fetchDepartmentBreakdown - Table:', employeeTableRef);
  try {
    const bigquery = getBigQueryClient();
    
    const query = `
      SELECT
        Department,
        COUNT(DISTINCT CASE WHEN UPPER(TRIM(Employment_Status)) = 'ACTIVE' THEN Employee_ID END) as active_count,
        COUNT(DISTINCT Employee_ID) as total_count
      FROM ${employeeTableRef}
      WHERE Department IS NOT NULL
      AND Employee_ID IS NOT NULL
      GROUP BY Department
      ORDER BY active_count DESC
    `;
    
    console.log('[DASHBOARD] fetchDepartmentBreakdown - Executing query');
    const [rows] = await bigquery.query({ query });
    const results = (rows as any[]).map((row) => ({
      Department: String(row.Department ?? ''),
      activeCount: Number(row.active_count ?? 0),
      totalCount: Number(row.total_count ?? 0),
    }));
    console.log('[DASHBOARD] fetchDepartmentBreakdown - Query succeeded, departments:', results.length);
    if (results.length === 0) {
      console.warn('[DASHBOARD] fetchDepartmentBreakdown - No departments found (unexpected - should have at least one)');
    }
    return results;
  } catch (error) {
    console.error('[DASHBOARD] fetchDepartmentBreakdown - Query failed:', {
      error: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      table: employeeTableRef,
    });
    return [];
  }
};

const fetchAttritionMetrics = async () => {
  try {
    const bigquery = getBigQueryClient();
    
    // Current month resignations
    const currentMonthQuery = `
      SELECT COUNT(DISTINCT Employee_ID) as count
      FROM ${employeeTableRef}
      WHERE UPPER(TRIM(Employment_Status)) IN ('RESIGNED/TERMINATED', 'RESIGNED', 'TERMINATED')
      AND DATE_TRUNC(CAST(Employment_End_Date AS DATE), MONTH) = DATE_TRUNC(CURRENT_DATE(), MONTH)
      AND Employee_ID IS NOT NULL
    `;
    
    // Previous month resignations
    const previousMonthQuery = `
      SELECT COUNT(DISTINCT Employee_ID) as count
      FROM ${employeeTableRef}
      WHERE UPPER(TRIM(Employment_Status)) IN ('RESIGNED/TERMINATED', 'RESIGNED', 'TERMINATED')
      AND DATE_TRUNC(CAST(Employment_End_Date AS DATE), MONTH) = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH)
      AND Employee_ID IS NOT NULL
    `;
    
    // Average headcount (current month)
    const avgHeadcountQuery = `
      SELECT COUNT(DISTINCT Employee_ID) as count
      FROM ${employeeTableRef}
      WHERE UPPER(TRIM(Employment_Status)) = 'ACTIVE'
      AND Employee_ID IS NOT NULL
    `;
    
    // Average tenure of resigned employees
    const tenureQuery = `
      SELECT AVG(DATE_DIFF(CAST(Employment_End_Date AS DATE), CAST(Joining_Date AS DATE), DAY)) as avg_tenure_days
      FROM ${employeeTableRef}
      WHERE UPPER(TRIM(Employment_Status)) IN ('RESIGNED/TERMINATED', 'RESIGNED', 'TERMINATED')
      AND Employment_End_Date IS NOT NULL
      AND Joining_Date IS NOT NULL
      AND Employee_ID IS NOT NULL
    `;
    
    const [currentRows, previousRows, headcountRows, tenureRows] = await Promise.all([
      bigquery.query({ query: currentMonthQuery }),
      bigquery.query({ query: previousMonthQuery }),
      bigquery.query({ query: avgHeadcountQuery }),
      bigquery.query({ query: tenureQuery }),
    ]);
    
    const currentMonthResignations = Number((currentRows[0][0] as { count: number })?.count ?? 0);
    const previousMonthResignations = Number((previousRows[0][0] as { count: number })?.count ?? 0);
    const avgHeadcount = Number((headcountRows[0][0] as { count: number })?.count ?? 0);
    const avgTenureDays = Number((tenureRows[0][0] as { avg_tenure_days: number })?.avg_tenure_days ?? 0);
    
    const currentMonthRate = avgHeadcount > 0 ? (currentMonthResignations / avgHeadcount) * 100 : 0;
    const previousMonthRate = avgHeadcount > 0 ? (previousMonthResignations / avgHeadcount) * 100 : 0;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (currentMonthRate > previousMonthRate * 1.1) trend = 'up';
    else if (currentMonthRate < previousMonthRate * 0.9) trend = 'down';
    
    const avgTenureMonths = avgTenureDays / 30;
    
    return {
      currentMonthRate: Math.round(currentMonthRate * 100) / 100,
      previousMonthRate: Math.round(previousMonthRate * 100) / 100,
      trend,
      averageTenure: Math.round(avgTenureMonths * 10) / 10,
    };
  } catch (error) {
    console.error('[DASHBOARD] Error fetching attrition metrics:', error);
    return {
      currentMonthRate: 0,
      previousMonthRate: 0,
      trend: 'stable' as const,
      averageTenure: 0,
    };
  }
};

const fetchPendingRequests = async () => {
  const bigquery = getBigQueryClient();
  const onboardingTable = process.env.BQ_ONBOARDING_TABLE ?? 'Employee_Onboarding_Intake';
  const onboardingTableRef = `\`${projectId}.${dataset}.${onboardingTable}\``;
  
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM ${onboardingTableRef}
      WHERE Status = 'pending'
    `;
    const [rows] = await bigquery.query({ query });
    const onboardingCount = Number((rows[0] as { count: number })?.count ?? 0);
    
    return {
      onboarding: onboardingCount,
      changeRequests: 0, // Change request system not implemented yet
    };
  } catch (error) {
    console.warn('[DASHBOARD] Could not fetch pending requests:', error);
    return {
      onboarding: 0,
      changeRequests: 0,
    };
  }
};

export const getDashboardSummary = async (requestedMonth?: string): Promise<DashboardSummary> => {
  try {
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

    const [employees, payroll, eobi, newJoiners, probationsEnding, departmentBreakdown, attrition, pendingRequests] = await Promise.all([
      fetchEmployeeCounts(),
      activeMonth ? fetchPayrollSummary(activeMonth) : Promise.resolve([]),
      activeMonth ? fetchEobiSummary(activeMonth) : Promise.resolve({ headcount: 0, employeeContribution: 0, employerContribution: 0, totalContribution: 0 }),
      fetchNewJoinersThisMonth(),
      fetchProbationsEndingSoon(),
      fetchDepartmentBreakdown(),
      fetchAttritionMetrics(),
      fetchPendingRequests(),
    ]);

    // Log final summary for diagnostics
    console.log(`[DASHBOARD] Summary generated:`, {
      employees,
      newJoiners,
      probationsEnding: probationsEnding.length,
      departmentBreakdown: departmentBreakdown.length,
      hasAlerts: (probationsEnding.length > 0 || (pendingRequests?.onboarding ?? 0) > 0),
      hasDepartmentBreakdown: departmentBreakdown.length > 0,
      payrollMonth: activeMonth,
      payrollTotals: payroll.length,
      eobiHeadcount: eobi.headcount,
    });
    console.log('[DASHBOARD] Sections visibility:', {
      alertsSection: (probationsEnding.length > 0 || (pendingRequests?.onboarding ?? 0) > 0),
      departmentBreakdownSection: departmentBreakdown.length > 0,
    });

    return {
      employees,
      newJoiners,
      probationsEnding,
      departmentBreakdown,
      attrition,
      pendingRequests,
      payroll: {
        month: activeMonth,
        monthLabel,
        totals: payroll,
      },
      eobi,
      months,
    };
  } catch (error) {
    console.error('[DASHBOARD] Error in getDashboardSummary:', error);
    // Return a safe default summary to prevent complete dashboard failure
    const months = await fetchSalaryMonths().catch(() => []);
    const activeMonth = requestedMonth ?? months[0]?.value;
    const monthLabel = months.find((month) => month.value === activeMonth)?.label;
    
    return {
      employees: { total: 0, active: 0, resigned: 0 },
      newJoiners: 0,
      probationsEnding: [],
      departmentBreakdown: [],
      attrition: {
        currentMonthRate: 0,
        previousMonthRate: 0,
        trend: 'stable' as const,
        averageTenure: 0,
      },
      pendingRequests: {
        onboarding: 0,
        changeRequests: 0,
      },
      payroll: {
        month: activeMonth,
        monthLabel,
        totals: [],
      },
      eobi: {
        headcount: 0,
        employeeContribution: 0,
        employerContribution: 0,
        totalContribution: 0,
      },
      months,
    } as DashboardSummary;
  }
};


