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

const fetchEmployeeCounts = async () => {
  const bigquery = getBigQueryClient();
  const query = `
    SELECT
      COUNT(1) AS total,
      SUM(CASE WHEN Employment_Status = 'Active' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN Employment_Status = 'Resigned/Terminated' THEN 1 ELSE 0 END) AS resigned
    FROM ${employeeTableRef}
  `;
  const [rows] = await bigquery.query({ query });
  const row = rows[0] as { total: number; active: number; resigned: number };
  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    resigned: Number(row?.resigned ?? 0),
  };
};

export const getDashboardSummary = async (requestedMonth?: string): Promise<DashboardSummary> => {
  const months = await fetchSalaryMonths();
  const activeMonth = requestedMonth ?? months[0]?.value;
  const monthLabel = months.find((month) => month.value === activeMonth)?.label;

  const [employees, payroll, eobi] = await Promise.all([
    fetchEmployeeCounts(),
    activeMonth ? fetchPayrollSummary(activeMonth) : Promise.resolve([]),
    activeMonth ? fetchEobiSummary(activeMonth) : Promise.resolve({ headcount: 0, employeeContribution: 0, employerContribution: 0, totalContribution: 0 }),
  ]);

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


