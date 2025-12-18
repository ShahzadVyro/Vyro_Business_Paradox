"use client";

import { useMemo } from "react";
import { useEmployees } from "@/hooks/use-employees";
import type { EmployeeFilters, EmploymentStatus } from "@/types/employee";
import EmployeeCard from "./employee-card";
import SearchBar from "./search-bar";
import DownloadButton from "../ui/download-button";

interface Props {
  filters: EmployeeFilters;
  onFiltersChange: (updater: (prev: EmployeeFilters) => EmployeeFilters) => void;
  onSelect: (employeeId: number) => void;
  selectedId?: number | null;
}

const statusOptions: EmploymentStatus[] = ["Active", "Resigned/Terminated"];
const departments = ["All", "Product", "Engineering", "Design", "Marketing", "HR & Admin", "People"];

const EmployeeList = ({ filters, onFiltersChange, onSelect, selectedId }: Props) => {
  const { data, isLoading } = useEmployees(filters);
  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ format: "csv" });
    if (filters.status) params.append("status", filters.status);
    if (filters.department) params.append("department", filters.department);
    if (filters.search) params.append("search", filters.search);
    if (filters.limit) params.append("limit", String(filters.limit));
    if (filters.offset) params.append("offset", String(filters.offset));
    return `/api/employees?${params.toString()}`;
  }, [filters.department, filters.limit, filters.offset, filters.search, filters.status]);

  const updateFilter = (key: keyof EmployeeFilters, value?: string) => {
    onFiltersChange((prev) => ({
      ...prev,
      [key]: value && value.length > 0 ? value : undefined,
    }));
  };

  return (
    <section className="rounded-4xl bg-white p-6 shadow-2xl shadow-slate-200/60 ring-1 ring-slate-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <SearchBar value={filters.search ?? ""} onChange={(value) => updateFilter("search", value)} />
        <div className="flex flex-wrap items-center gap-2">
          {statusOptions.map((status) => {
            const active = filters.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => updateFilter("status", active ? undefined : status)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={filters.department ?? "All"}
            onChange={(event) =>
              updateFilter("department", event.target.value === "All" ? undefined : event.target.value)
            }
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
          >
            {departments.map((dept) => (
              <option key={dept}>{dept}</option>
            ))}
          </select>
          <DownloadButton label="Export current view" href={exportHref} />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
          Loading employees from BigQuery...
        </div>
      ) : !data || data.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
          No employees match these filters.
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {data.map((employee) => (
            <EmployeeCard
              key={employee.Employee_ID}
              employee={employee}
              selected={selectedId === employee.Employee_ID}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default EmployeeList;

