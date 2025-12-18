"use client";

import { useState } from "react";
import EmployeeList from "./employee-list";
import EmployeeDetail from "./employee-detail";
import { useEmployeeDetail } from "@/hooks/use-employees";
import type { EmployeeFilters } from "@/types/employee";
import PakistanClock from "./pakistan-clock";
import type { DashboardView } from "@/types/dashboard";

const EmployeeDashboard = () => {
  const [filters, setFilters] = useState<EmployeeFilters>({ limit: 50 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<DashboardView>("all");
  const { data: employeeDetail, isLoading: detailLoading } = useEmployeeDetail(selectedId ?? undefined);
  const hasSelection = Boolean(employeeDetail?.profile);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Vyro • People Operations</p>
          <h1 className="text-4xl font-semibold text-slate-900">Employee Intelligence</h1>
          <p className="text-sm text-slate-500">Live data from BigQuery • PKT (GMT+5)</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          Local time in Karachi:
          <br />
          <PakistanClock />
        </div>
      </header>

      <div className={`grid gap-8 ${hasSelection ? "lg:grid-cols-2" : ""}`}>
        <EmployeeList
          filters={filters}
          onFiltersChange={(updater) => setFilters((prev) => updater(prev))}
          onSelect={setSelectedId}
          selectedId={selectedId ?? undefined}
        />
        {hasSelection && (
          <EmployeeDetail view={view} onViewChange={setView} data={employeeDetail} isLoading={detailLoading} />
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;

