"use client";

import Link from "next/link";
import { useState } from "react";
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
  const { data, isLoading } = useDashboardSummary(month);

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
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard label="Total Employees" value={data.employees.total} caption="Directory records" />
            <StatCard label="Active" value={data.employees.active} caption="Currently employed" trend="positive" />
            <StatCard label="Resigned / Terminated" value={data.employees.resigned} caption="Offboarded records" trend="negative" />
          </section>

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
              <div className="flex gap-3">
                <LinkButton href="/eobi" label="Go to EOBI explorer" />
                <DownloadButton
                  variant="secondary"
                  label="Download EOBI sheet"
                  href={`/api/eobi?format=csv${data.payroll.month ? `&month=${data.payroll.month}` : ""}`}
                />
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


