"use client";

import { useMemo, useState } from "react";
import { useSalaries } from "@/hooks/use-salaries";
import type { SalaryFilters } from "@/types/payroll";
import type { SalaryRecord } from "@/types/api/payroll";
import DownloadButton from "@/components/ui/download-button";
import { formatDate } from "@/lib/formatters";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import EditableCell from "./editable-cell";

const PAGE_SIZE = 50;
const formatByCurrency = (value?: number | null, currency?: string | null) => {
  if (!value && value !== 0) return "—";
  const resolvedCurrency = currency === "USD" ? "USD" : "PKR";
  return new Intl.NumberFormat(resolvedCurrency === "USD" ? "en-US" : "en-PK", {
    style: "currency",
    currency: resolvedCurrency,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value?: number | null) => {
  if (!value && value !== 0) return "—";
  return value.toLocaleString();
};

interface CreateSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (month: string, currency: string) => void;
  currentMonth?: string;
  currentCurrency?: string;
}

const CreateSheetModal = ({ isOpen, onClose, onConfirm, currentMonth, currentCurrency }: CreateSheetModalProps) => {
  const [month, setMonth] = useState(currentMonth || "");
  const [currency, setCurrency] = useState<"USD" | "PKR">((currentCurrency as "USD" | "PKR") || "PKR");
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!month) {
      alert("Please select a month");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/salaries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, currency }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create salary sheet");
      }

      const result = await response.json();
      alert(`Successfully created ${result.created} salary records`);
      onConfirm(month, currency);
      onClose();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Create Salary Sheet</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "USD" | "PKR")}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isCreating || !month}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Create Sheet"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SalaryExplorer = () => {
  const [filters, setFilters] = useState<SalaryFilters>({ currency: "PKR", limit: PAGE_SIZE, offset: 0 });
  const { data, isLoading, isFetching, refetch } = useSalaries(filters);
  const activeMonth = filters.month ?? data?.activeMonth;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hasData, setHasData] = useState(true);
  const queryClient = useQueryClient();

  const updateSalaryMutation = useMutation({
    mutationFn: async ({ salaryId, updates }: { salaryId: number; updates: Partial<SalaryRecord> }) => {
      const response = await fetch(`/api/salaries/${salaryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update salary");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaries", filters] });
    },
  });

  const currentPage = Math.floor((filters.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = data?.total ? Math.ceil(data.total / PAGE_SIZE) : 1;

  // Check if there's data for the selected month/currency
  useMemo(() => {
    if (!isLoading && data) {
      setHasData(data.rows.length > 0 || (data.total ?? 0) > 0);
    }
  }, [data, isLoading]);

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

  const handleCreateSheet = (month: string, currency: string) => {
    updateFilter({ month, currency });
    setTimeout(() => refetch(), 1000);
  };

  return (
    <section className="space-y-6">
      <header className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Monthly Salaries</p>
            <h1 className="text-2xl font-semibold text-slate-900">Enhanced Salary Sheets</h1>
            <p className="text-sm text-slate-500">Pick a payroll month + currency to view/export the sheet you need.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700"
            >
              Create Sheet
            </button>
            <DownloadButton label="Download CSV" href={downloadHref} variant="primary" />
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
        ) : !hasData && activeMonth ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-400 mb-4">No salary data found for this month and currency.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700"
            >
              Create Salary Sheet
            </button>
          </div>
        ) : data?.rows?.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-left sticky left-0 bg-slate-50 z-10">Status</th>
                    <th className="px-2 py-2 text-left">ID</th>
                    <th className="px-2 py-2 text-left">Name</th>
                    <th className="px-2 py-2 text-left">Designation</th>
                    <th className="px-2 py-2 text-left">Email</th>
                    <th className="px-2 py-2 text-left">Join Date</th>
                    <th className="px-2 py-2 text-left">Leave Date</th>
                    <th className="px-2 py-2 text-left">Worked Days</th>
                    <th className="px-2 py-2 text-left">Last Month Salary</th>
                    <th className="px-2 py-2 text-left">Increment</th>
                    <th className="px-2 py-2 text-left">Increment Date</th>
                    <th className="px-2 py-2 text-left">Payable From Last</th>
                    <th className="px-2 py-2 text-left">Regular Pay</th>
                    <th className="px-2 py-2 text-left">Revised w/ OPD</th>
                    <th className="px-2 py-2 text-left">Prorated Pay</th>
                    <th className="px-2 py-2 text-left">Perf Bonus</th>
                    <th className="px-2 py-2 text-left">Overtime</th>
                    <th className="px-2 py-2 text-left">Reimbursements</th>
                    <th className="px-2 py-2 text-left">Other</th>
                    <th className="px-2 py-2 text-left">Gross Income</th>
                    <th className="px-2 py-2 text-left">Unpaid Leaves</th>
                    <th className="px-2 py-2 text-left">Deductions</th>
                    <th className="px-2 py-2 text-left">Net Income</th>
                    <th className="px-2 py-2 text-left">Comments</th>
                    <th className="px-2 py-2 text-left">Internal Comments</th>
                    <th className="px-2 py-2 text-left">Payslip Status</th>
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
                    
                    const handleUpdate = async (updates: Partial<SalaryRecord>) => {
                      if (!row.Salary_ID) {
                        alert("Cannot update: Salary ID missing");
                        return;
                      }
                      await updateSalaryMutation.mutateAsync({
                        salaryId: row.Salary_ID,
                        updates,
                      });
                    };

                    return (
                      <tr key={rowKey} className="hover:bg-slate-50">
                        <td className="px-2 py-2 text-left sticky left-0 bg-white z-10">
                          <EditableCell
                            value={row.Salary_Status || "HOLD"}
                            field="Salary_Status"
                            onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                            type="select"
                            options={[
                              { value: "Released", label: "Released" },
                              { value: "HOLD", label: "HOLD" },
                            ]}
                            formatValue={(val) => {
                              const status = String(val || "HOLD");
                              return status;
                            }}
                            className="px-2 py-2"
                          />
                        </td>
                        <td className="px-2 py-2 font-mono text-slate-500">{row.Employee_ID}</td>
                        <td className="px-2 py-2 font-semibold text-slate-900">{row.Employee_Name}</td>
                        <td className="px-2 py-2 text-slate-600">{row.Designation || "—"}</td>
                        <td className="px-2 py-2 text-slate-600">{row.Email || "—"}</td>
                        <td className="px-2 py-2 text-slate-600">{row.Date_of_Joining ? formatDate(row.Date_of_Joining) : "—"}</td>
                        <td className="px-2 py-2 text-slate-600">{row.Date_of_Leaving ? formatDate(row.Date_of_Leaving) : "—"}</td>
                        <td className="px-2 py-2 text-slate-600">{formatNumber(row.Worked_Days)}</td>
                        <td className="px-2 py-2 text-slate-600">{formatByCurrency(row.Last_Month_Salary, row.Currency)}</td>
                        <td className="px-2 py-2 text-slate-600">{formatByCurrency(row.New_Addition_Increment_Decrement, row.Currency)}</td>
                        <td className="px-2 py-2 text-slate-600">{row.Date_of_Increment_Decrement ? formatDate(row.Date_of_Increment_Decrement) : "—"}</td>
                        <EditableCell
                          value={row.Payable_from_Last_Month}
                          field="Payable_from_Last_Month"
                          currency={row.Currency}
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="number"
                          formatValue={(val) => formatByCurrency(val as number | null, row.Currency)}
                          parseValue={(val) => (val === "" ? null : parseFloat(val))}
                        />
                        <td className="px-2 py-2 text-slate-900 font-medium">{formatByCurrency(row.Regular_Pay, row.Currency)}</td>
                        <td className="px-2 py-2 text-slate-600">{formatByCurrency(row.Revised_with_OPD, row.Currency)}</td>
                        <td className="px-2 py-2 text-slate-900 font-medium">{formatByCurrency(row.Prorated_Pay, row.Currency)}</td>
                        <EditableCell
                          value={row.Performance_Bonus}
                          field="Performance_Bonus"
                          currency={row.Currency}
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="number"
                          formatValue={(val) => formatByCurrency(val as number | null, row.Currency)}
                          parseValue={(val) => (val === "" ? null : parseFloat(val))}
                        />
                        <EditableCell
                          value={row.Paid_Overtime}
                          field="Paid_Overtime"
                          currency={row.Currency}
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="number"
                          formatValue={(val) => formatByCurrency(val as number | null, row.Currency)}
                          parseValue={(val) => (val === "" ? null : parseFloat(val))}
                        />
                        <EditableCell
                          value={row.Reimbursements}
                          field="Reimbursements"
                          currency={row.Currency}
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="number"
                          formatValue={(val) => formatByCurrency(val as number | null, row.Currency)}
                          parseValue={(val) => (val === "" ? null : parseFloat(val))}
                        />
                        <EditableCell
                          value={row.Other}
                          field="Other"
                          currency={row.Currency}
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="number"
                          formatValue={(val) => formatByCurrency(val as number | null, row.Currency)}
                          parseValue={(val) => (val === "" ? null : parseFloat(val))}
                        />
                        <td className="px-2 py-2 text-slate-900 font-bold">{formatByCurrency(row.Gross_Income, row.Currency)}</td>
                        <EditableCell
                          value={row.Unpaid_Leaves}
                          field="Unpaid_Leaves"
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="number"
                          formatValue={formatNumber}
                          parseValue={(val) => (val === "" ? null : parseFloat(val))}
                        />
                        <EditableCell
                          value={row.Deductions}
                          field="Deductions"
                          currency={row.Currency}
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="number"
                          formatValue={(val) => formatByCurrency(val as number | null, row.Currency)}
                          parseValue={(val) => (val === "" ? null : parseFloat(val))}
                        />
                        <td className="px-2 py-2 text-slate-900 font-bold">{formatByCurrency(row.Net_Income, row.Currency)}</td>
                        <EditableCell
                          value={row.Comments}
                          field="Comments"
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="text"
                          className="px-2 py-2 text-slate-600 max-w-xs"
                        />
                        <EditableCell
                          value={row.Internal_Comments}
                          field="Internal_Comments"
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="text"
                          className="px-2 py-2 text-slate-600 max-w-xs"
                        />
                        <EditableCell
                          value={row.PaySlip_Status || "Not Sent"}
                          field="PaySlip_Status"
                          onSave={async (field, value) => handleUpdate({ [field]: value } as Partial<SalaryRecord>)}
                          type="select"
                          options={[
                            { value: "Sent", label: "Sent" },
                            { value: "Not Sent", label: "Not Sent" },
                          ]}
                          className="px-2 py-2"
                        />
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

      <CreateSheetModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateSheet}
        currentMonth={activeMonth}
        currentCurrency={filters.currency}
      />
    </section>
  );
};

export default SalaryExplorer;
