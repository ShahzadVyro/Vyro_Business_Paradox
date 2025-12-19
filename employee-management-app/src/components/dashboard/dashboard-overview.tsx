"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import DownloadButton from "@/components/ui/download-button";

const formatByCurrency = (value?: number | null, currency = "PKR") => {
  if (!value) return "—";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-PK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

const DashboardOverview = () => {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [bulkUploadMonth, setBulkUploadMonth] = useState<string>(() => {
    // Default to previous month (e.g., if current is Jan 2026, default to Dec 2025)
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  });
  const { data, isLoading } = useDashboardSummary(month);

  // Debug logging for production
  useEffect(() => {
    if (!isLoading && data) {
      console.log('[DASHBOARD_CLIENT] Data received:', {
        probationsEnding: data.probationsEnding?.length,
        departmentBreakdown: data.departmentBreakdown?.length,
        pendingRequests: data.pendingRequests,
        hasAlerts: (data.probationsEnding && data.probationsEnding.length > 0) || (data.pendingRequests && (data.pendingRequests.onboarding > 0 || data.pendingRequests.changeRequests > 0)),
        hasDepartmentBreakdown: data.departmentBreakdown && data.departmentBreakdown.length > 0,
      });
      console.log('[DASHBOARD_CLIENT] Probations ending array:', data.probationsEnding);
      console.log('[DASHBOARD_CLIENT] Department breakdown array:', data.departmentBreakdown);
      console.log('[DASHBOARD_CLIENT] Should show alerts section:', 
        (data.probationsEnding && data.probationsEnding.length > 0) || 
        (data.pendingRequests && (data.pendingRequests.onboarding > 0 || data.pendingRequests.changeRequests > 0))
      );
      console.log('[DASHBOARD_CLIENT] Should show department breakdown section:', 
        data.departmentBreakdown && data.departmentBreakdown.length > 0
      );
    }
  }, [data, isLoading]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="rounded-4xl border border-slate-200 bg-white/70 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Vyro • Ops Control Tower</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">Unified People Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Live view of the employee directory, the PKR/USD salary sheets, and the EOBI filings – all sourced from BigQuery and matching the original Excel
              workbooks.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-500">
            <label className="text-xs uppercase tracking-wide text-slate-400">Payroll Month</label>
            <select
              value={data?.payroll.month ?? month ?? ""}
              onChange={(event) => setMonth(event.target.value || undefined)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
            >
              {!data?.payroll.month && <option value="">Select month</option>}
              {data?.months?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {isLoading || !data ? (
        <div className="rounded-4xl border border-dashed border-slate-200 bg-white/60 p-10 text-center text-sm text-slate-400">
          Loading dashboard summary…
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Employees" value={data.employees.total} caption="Directory records" />
            <StatCard label="Active" value={data.employees.active} caption="Currently employed" trend="positive" />
            <StatCard label="Resigned / Terminated" value={data.employees.resigned} caption="Offboarded records" trend="negative" />
            {data.newJoiners !== undefined && (
              <StatCard label="New Joiners" value={data.newJoiners} caption="This month" />
            )}
          </section>

          {/* Alerts Section */}
          {(data.probationsEnding && data.probationsEnding.length > 0) || (data.pendingRequests && (data.pendingRequests.onboarding > 0 || data.pendingRequests.changeRequests > 0)) ? (
            <section className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-4">Alerts & Reminders</p>
              <div className="space-y-4">
                {data.probationsEnding && data.probationsEnding.length > 0 && (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-amber-900">Probations Ending Soon ({data.probationsEnding.length})</p>
                      <Link href="/directory" className="text-xs font-semibold text-amber-700 underline">View All</Link>
                    </div>
                    <div className="mt-2 space-y-2">
                      {data.probationsEnding.slice(0, 5).map((emp) => (
                        <div key={emp.Employee_ID} className="flex items-center justify-between text-sm">
                          <span className="text-amber-800">{emp.Full_Name}</span>
                          <span className="text-amber-600">{emp.daysRemaining} days remaining</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.pendingRequests && (data.pendingRequests.onboarding > 0 || data.pendingRequests.changeRequests > 0) && (
                  <div className="rounded-3xl border border-blue-200 bg-blue-50/80 p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">Pending Requests</p>
                    <div className="flex gap-4 text-sm">
                      {data.pendingRequests.onboarding > 0 && (
                        <Link href="/submissions" className="text-blue-700 underline">
                          {data.pendingRequests.onboarding} Onboarding {data.pendingRequests.onboarding === 1 ? 'Submission' : 'Submissions'}
                        </Link>
                      )}
                      {data.pendingRequests.changeRequests > 0 && (
                        <span className="text-blue-600">{data.pendingRequests.changeRequests} Change Requests</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {/* Department Breakdown */}
          {data.departmentBreakdown && data.departmentBreakdown.length > 0 && (
            <section className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-4">Department Breakdown</p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.departmentBreakdown.map((dept) => (
                  <div key={dept.Department} className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">{dept.Department}</p>
                    <div className="mt-2 flex gap-4 text-xs text-slate-600">
                      <span>Active: <span className="font-semibold text-slate-900">{dept.activeCount}</span></span>
                      <span>Total: <span className="font-semibold text-slate-900">{dept.totalCount}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Attrition Metrics */}
          {data.attrition && (
            <section className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-4">Attrition Metrics</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Current Month Rate</p>
                  <p className="text-2xl font-semibold text-slate-900">{data.attrition.currentMonthRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Previous Month Rate</p>
                  <p className="text-2xl font-semibold text-slate-900">{data.attrition.previousMonthRate}%</p>
                  {data.attrition.trend === 'up' && <span className="text-xs font-semibold text-rose-500">↑ Increasing</span>}
                  {data.attrition.trend === 'down' && <span className="text-xs font-semibold text-emerald-500">↓ Decreasing</span>}
                  {data.attrition.trend === 'stable' && <span className="text-xs font-semibold text-slate-500">→ Stable</span>}
                </div>
                <div>
                  <p className="text-xs text-slate-400">Average Tenure</p>
                  <p className="text-2xl font-semibold text-slate-900">{data.attrition.averageTenure} months</p>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Salary Sheets</p>
                <h2 className="text-2xl font-semibold text-slate-900">{data.payroll.monthLabel ?? "Latest cycle"}</h2>
                <p className="text-sm text-slate-500">Totals are calculated directly from PKR/USD sheets.</p>
              </div>
              <div className="flex gap-3">
                <LinkButton href="/salaries" label="Go to salary explorer" />
                <DownloadButton
                  variant="secondary"
                  label="Download PKR sheet"
                  href={`/api/salaries?format=csv&currency=PKR${data.payroll.month ? `&month=${data.payroll.month}` : ""}`}
                />
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {data.payroll.totals.length === 0 && <p className="text-sm text-slate-500">No payroll rows for this month yet.</p>}
              {data.payroll.totals.map((row) => (
                <div key={row.currency} className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{row.currency} sheet</p>
                  <p className="mt-2 text-sm text-slate-500">Headcount: {row.headcount}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Gross</p>
                      <p className="text-lg font-semibold text-slate-900">{formatByCurrency(row.grossIncome, row.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Net</p>
                      <p className="text-lg font-semibold text-slate-900">{formatByCurrency(row.netIncome, row.currency)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">EOBI Submissions</p>
                <h2 className="text-2xl font-semibold text-slate-900">{data.payroll.monthLabel ?? "Latest cycle"}</h2>
                <p className="text-sm text-slate-500">Employee + employer contributions exactly as filed.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="/eobi" label="Go to EOBI explorer" />
                <DownloadButton
                  variant="primary"
                  label="Download Registration CSV (New Employees)"
                  href="/api/eobi/registration"
                />
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <label htmlFor="dashboard-bulk-upload-month" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                    Month:
                  </label>
                  <input
                    id="dashboard-bulk-upload-month"
                    type="month"
                    value={bulkUploadMonth}
                    onChange={(e) => setBulkUploadMonth(e.target.value)}
                    className="rounded-xl border border-slate-200 px-2 py-1 text-xs text-slate-700"
                    min="2020-01"
                    max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                  />
                  <DownloadButton
                    variant="secondary"
                    label="Generate Monthly Upload CSV"
                    href={`/api/eobi/bulk-upload?month=${bulkUploadMonth}`}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <StatCard label="Employees covered" value={data.eobi.headcount} caption="Matched via CNIC" />
              <StatCard label="Employee contribution" value={formatByCurrency(data.eobi.employeeContribution, "PKR")} caption="Cumulative" />
              <StatCard label="Employer contribution" value={formatByCurrency(data.eobi.employerContribution, "PKR")} caption="Cumulative" />
            </div>
          </section>

          <section className="rounded-4xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white">
            <h2 className="text-2xl font-semibold">Need the raw sheets?</h2>
            <p className="mt-2 text-sm text-slate-200">Jump directly to the dedicated directory, salary, or EOBI workspace.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <LinkButton href="/directory" label="Employee directory" inverted />
              <LinkButton href="/salaries" label="Salary sheets" inverted />
              <LinkButton href="/eobi" label="EOBI sheets" inverted />
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const LinkButton = ({ href, label, inverted = false }: { href: string; label: string; inverted?: boolean }) => (
  <Link
    href={href}
    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
      inverted ? "bg-white/10 text-white ring-1 ring-white/50 hover:bg-white/20" : "bg-slate-900 text-white hover:bg-slate-800"
    }`}
  >
    {label}
  </Link>
);

const StatCard = ({
  label,
  value,
  caption,
  trend,
}: {
  label: string;
  value: number | string;
  caption?: string;
  trend?: "positive" | "negative";
}) => (
  <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    {caption && <p className="text-sm text-slate-500">{caption}</p>}
    {trend === "positive" && <span className="text-xs font-semibold text-emerald-500">Healthy coverage</span>}
    {trend === "negative" && <span className="text-xs font-semibold text-rose-500">Monitor exits</span>}
  </div>
);

export default DashboardOverview;


