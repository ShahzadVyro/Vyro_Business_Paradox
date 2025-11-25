"use client";

import { useMemo, useState } from "react";
import { useSalaries } from "@/hooks/use-salaries";
import type { SalaryFilters } from "@/types/payroll";
import DownloadButton from "@/components/ui/download-button";
import { formatDate } from "@/lib/formatters";

const PAGE_SIZE = 50;
const formatByCurrency = (value?: number | null, currency?: string | null) => {
  if (!value) return "—";
  const resolvedCurrency = currency === "USD" ? "USD" : "PKR";
  return new Intl.NumberFormat(resolvedCurrency === "USD" ? "en-US" : "en-PK", {
    style: "currency",
    currency: resolvedCurrency,
    maximumFractionDigits: 0,
  }).format(value);
};

const SalaryExplorer = () => {
  const [filters, setFilters] = useState<SalaryFilters>({ currency: "PKR", limit: PAGE_SIZE, offset: 0 });
  const { data, isLoading, isFetching } = useSalaries(filters);
  const activeMonth = filters.month ?? data?.activeMonth;

  const currentPage = Math.floor((filters.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = data?.total ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const updateFilter = (partial: Partial<SalaryFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...partial,
      offset: partial.search !== undefined || partial.month !== undefined || partial.currency !== undefined ? 0 : partial.offset ?? prev.offset ?? 0,
    }));
  };

  const downloadHref = useMemo(() => {
    const params = new URLSearchParams({ format: "csv" });
    if (activeMonth) params.append("month", activeMonth);
    if (filters.currency) params.append("currency", filters.currency);
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    return `/api/salaries?${params.toString()}`;
  }, [activeMonth, filters.currency, filters.search, filters.status]);

  return (
    <section className="space-y-6">
      <header className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Monthly Salaries</p>
            <h1 className="text-2xl font-semibold text-slate-900">Exact replica of the payroll workbook</h1>
            <p className="text-sm text-slate-500">Pick a payroll month + currency to view/export the sheet you need.</p>
          </div>
          <DownloadButton label="Download current sheet" href={downloadHref} variant="primary" />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={activeMonth ?? ""}
            onChange={(event) => updateFilter({ month: event.target.value || undefined })}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
          >
            {!activeMonth && <option value="">Select month</option>}
            {data?.months?.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <select
            value={filters.currency ?? "PKR"}
            onChange={(event) => updateFilter({ currency: event.target.value })}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
          >
            <option value="PKR">PKR Sheets</option>
            <option value="USD">USD Sheets</option>
          </select>

          <select
            value={filters.status ?? "All"}
            onChange={(event) => updateFilter({ status: event.target.value === "All" ? undefined : event.target.value })}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Resigned/Terminated">Resigned/Terminated</option>
          </select>

          <input
            type="search"
            placeholder="Search ID, name, or email"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
            value={filters.search ?? ""}
            onChange={(event) => updateFilter({ search: event.target.value || undefined })}
          />
        </div>
      </header>

      <div className="rounded-4xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-slate-400">Loading salary sheet…</p>
        ) : data?.rows?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Employee ID</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Department</th>
                    <th className="px-3 py-2 text-left">Payroll Month</th>
                    <th className="px-3 py-2 text-left">Currency</th>
                    <th className="px-3 py-2 text-left">Gross Income</th>
                    <th className="px-3 py-2 text-left">Net Income</th>
                    <th className="px-3 py-2 text-left">Tax</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row, index) => {
                    const rowKey =
                      row.Employee_ID ??
                      row.Official_Email ??
                      row.Personal_Email ??
                      (typeof row.Key === "string" ? row.Key : null) ??
                      `${row.Payroll_Month}-${row.Currency}-${index}`;
                    return (
                      <tr key={rowKey} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{row.Employee_ID}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{row.Employee_Name}</td>
                      <td className="px-3 py-2 text-slate-600">{row.Department ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(row.Payroll_Month)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.Currency}</td>
                      <td className="px-3 py-2 text-slate-900">{formatByCurrency(row.Gross_Income, row.Currency)}</td>
                      <td className="px-3 py-2 text-slate-900">{formatByCurrency(row.Net_Income, row.Currency)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatByCurrency(row.Tax_Deduction, row.Currency)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.Employment_Status ?? row.Status ?? "—"}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <p>
                Showing {(filters.offset ?? 0) + 1} – {Math.min((filters.offset ?? 0) + PAGE_SIZE, data.total)} of {data.total} rows{" "}
                {isFetching && <span className="ml-2 animate-pulse text-slate-400">(refreshing…)</span>}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateFilter({ offset: Math.max(0, (filters.offset ?? 0) - PAGE_SIZE) })}
                  disabled={currentPage <= 1}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 disabled:opacity-50"
                >
                  Prev
                </button>
                <span>
                  Page {currentPage} / {totalPages || 1}
                </span>
                <button
                  type="button"
                  onClick={() => updateFilter({ offset: (filters.offset ?? 0) + PAGE_SIZE })}
                  disabled={currentPage >= totalPages}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        ) : (
          <p className="p-6 text-center text-sm text-slate-400">No salary rows match the selected filters.</p>
        )}
      </div>
    </section>
  );
};

export default SalaryExplorer;


