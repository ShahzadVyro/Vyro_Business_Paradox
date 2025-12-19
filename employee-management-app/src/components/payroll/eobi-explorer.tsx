"use client";

import { useState } from "react";
import { useEobi } from "@/hooks/use-eobi";
import type { EobiFilters } from "@/types/payroll";
import DownloadButton from "@/components/ui/download-button";
import { formatCurrency, formatDate } from "@/lib/formatters";

const PAGE_SIZE = 50;

const EobiExplorer = () => {
  const [filters, setFilters] = useState<EobiFilters>({ limit: PAGE_SIZE, offset: 0 });
  const [bulkUploadMonth, setBulkUploadMonth] = useState<string>(() => {
    // Default to previous month (e.g., if current is Jan 2026, default to Dec 2025)
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  });
  const { data, isLoading, isFetching } = useEobi(filters);
  const activeMonth = filters.month ?? data?.activeMonth;

  const currentPage = Math.floor((filters.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = data?.total ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const updateFilter = (partial: Partial<EobiFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...partial,
      offset: partial.search !== undefined || partial.month !== undefined ? 0 : partial.offset ?? prev.offset ?? 0,
    }));
  };

  return (
    <section className="space-y-6">
      <header className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">EOBI Filing</p>
            <h1 className="text-2xl font-semibold text-slate-900">Government submissions per month</h1>
            <p className="text-sm text-slate-500">
              Download registration CSV for new employees, then generate monthly upload CSV for previous month submission.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <DownloadButton
              label="Download Registration CSV (New Employees)"
              href="/api/eobi/registration"
              variant="primary"
            />
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <label htmlFor="bulk-upload-month" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                Month:
              </label>
              <input
                id="bulk-upload-month"
                type="month"
                value={bulkUploadMonth}
                onChange={(e) => setBulkUploadMonth(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1 text-sm text-slate-700"
                min="2020-01"
                max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
              />
              <DownloadButton
                label="Generate Monthly Upload CSV"
                href={`/api/eobi/bulk-upload?month=${bulkUploadMonth || new Date().toISOString().slice(0, 7)}`}
                variant="secondary"
              />
            </div>
          </div>
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

          <input
            type="search"
            placeholder="Search ID, CNIC, or name"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
            value={filters.search ?? ""}
            onChange={(event) => updateFilter({ search: event.target.value || undefined })}
          />
        </div>
      </header>

      <div className="rounded-4xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-slate-400">Loading EOBI sheet…</p>
        ) : data?.rows?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">EMP AREA CODE</th>
                    <th className="px-3 py-2 text-left">EMP REG SERIAL</th>
                    <th className="px-3 py-2 text-left">SUB AREA</th>
                    <th className="px-3 py-2 text-left">SUB SERIAL</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">EOBI No</th>
                    <th className="px-3 py-2 text-left">CNIC</th>
                    <th className="px-3 py-2 text-left">NIC</th>
                    <th className="px-3 py-2 text-left">DOB</th>
                    <th className="px-3 py-2 text-left">DOJ</th>
                    <th className="px-3 py-2 text-left">DOE</th>
                    <th className="px-3 py-2 text-left">Days Worked</th>
                    <th className="px-3 py-2 text-left">From Date</th>
                    <th className="px-3 py-2 text-left">To Date</th>
                    <th className="px-3 py-2 text-left">Employee Contribution</th>
                    <th className="px-3 py-2 text-left">Employer Contribution</th>
                    <th className="px-3 py-2 text-left">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row, index) => (
                    <tr key={`${row.Employee_ID ?? row.CNIC}-${index}`} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.EMP_AREA_CODE ?? "FAA"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.EMP_REG_SERIAL_NO ?? "4320"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.EMP_SUB_AREA_CODE ?? " "}</td>
                      <td className="px-3 py-2 text-slate-600">{row.EMP_SUB_SERIAL_NO ?? "0"}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{row.NAME}</td>
                      <td className="px-3 py-2 text-slate-600">{row.EOBI_NO ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.CNIC ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.NIC ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(row.DOB)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(row.DOJ)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(row.DOE)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.NO_OF_DAYS_WORKED ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(row.From_Date)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(row.To_Date)}</td>
                      <td className="px-3 py-2 text-slate-900">{formatCurrency(row.Employee_Contribution)}</td>
                      <td className="px-3 py-2 text-slate-900">{formatCurrency(row.Employer_Contribution)}</td>
                      <td className="px-3 py-2 text-slate-900">{formatCurrency(row.Total_EOBI)}</td>
                    </tr>
                  ))}
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
          <p className="p-6 text-center text-sm text-slate-400">No EOBI rows match the selected filters.</p>
        )}
      </div>
    </section>
  );
};

export default EobiExplorer;


