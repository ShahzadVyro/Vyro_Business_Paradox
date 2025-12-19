"use client";

import { useMemo, useState } from "react";
import { useOPDBenefits } from "@/hooks/use-opd";
import type { OPDFilters } from "@/types/opd";
import DownloadButton from "@/components/ui/download-button";
import { formatCurrency, formatDate } from "@/lib/formatters";

const PAGE_SIZE = 50;

const OPDExplorer = () => {
  const [filters, setFilters] = useState<OPDFilters>({ currency: "PKR", limit: PAGE_SIZE, offset: 0 });
  const { data, isLoading, isFetching } = useOPDBenefits(filters);
  const activeMonth = filters.month ?? data?.activeMonth;

  const currentPage = Math.floor((filters.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = data?.total ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const updateFilter = (partial: Partial<OPDFilters>) => {
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
    if (filters.search) params.append("search", filters.search);
    return `/api/opd?${params.toString()}`;
  }, [activeMonth, filters.currency, filters.search]);

  return (
    <section className="space-y-6">
      <header className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">OPD Benefits</p>
            <h1 className="text-2xl font-semibold text-slate-900">Out Patient Department Benefits</h1>
            <p className="text-sm text-slate-500">Track monthly OPD contributions, claims, and balances for PKR salaried employees.</p>
          </div>
          <DownloadButton label="Download OPD data" href={downloadHref} variant="primary" />
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
            <option value="PKR">PKR Only</option>
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
          <p className="p-6 text-center text-sm text-slate-400">Loading OPD benefits…</p>
        ) : data?.rows?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Employee ID</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Department</th>
                    <th className="px-3 py-2 text-left">Benefit Month</th>
                    <th className="px-3 py-2 text-left">Contribution</th>
                    <th className="px-3 py-2 text-left">Claimed</th>
                    <th className="px-3 py-2 text-left">Balance</th>
                    <th className="px-3 py-2 text-left">Currency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row, index) => {
                    const rowKey = `${row.Employee_ID}-${row.Benefit_Month}-${index}`;
                    return (
                      <tr key={rowKey} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{row.Employee_ID}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{row.Full_Name ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{row.Department ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{formatDate(row.Benefit_Month)}</td>
                        <td className="px-3 py-2 text-slate-900">{formatCurrency(row.Contribution_Amount)}</td>
                        <td className="px-3 py-2 text-slate-600">{formatCurrency(row.Claimed_Amount)}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{formatCurrency(row.Balance)}</td>
                        <td className="px-3 py-2 text-slate-600">{row.Currency ?? "PKR"}</td>
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
          <p className="p-6 text-center text-sm text-slate-400">No OPD benefits match the selected filters.</p>
        )}
      </div>
    </section>
  );
};

export default OPDExplorer;


