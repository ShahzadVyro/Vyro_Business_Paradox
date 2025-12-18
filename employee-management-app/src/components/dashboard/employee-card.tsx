"use client";

import type { EmployeeRecord } from "@/types/employee";
import StatusBadge from "../ui/status-badge";
import { formatDate } from "@/lib/formatters";
import clsx from "clsx";

interface Props {
  employee: EmployeeRecord;
  selected?: boolean;
  onSelect: (employeeId: number) => void;
}

const EmployeeCard = ({ employee, selected, onSelect }: Props) => {
  const offboardingBadge =
    employee.Offboarding_Status === "scheduled" && employee.Offboarding_Date_ISO
      ? `Leaving ${formatDate(employee.Offboarding_Date_ISO)}`
      : null;

  return (
    <button
    type="button"
    onClick={() => onSelect(employee.Employee_ID)}
    className={clsx(
      "flex w-full items-center justify-between rounded-3xl border px-4 py-3 text-left shadow-sm transition",
      selected
        ? "border-cyan-400 bg-cyan-50 shadow-lg"
        : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-md",
    )}
  >
    <div>
      <p className="text-sm font-semibold text-slate-900">{employee.Full_Name}</p>
      <p className="text-xs text-slate-500">{employee.Official_Email ?? "—"}</p>
      <p className="text-xs text-slate-400">Joined {formatDate(employee.Joining_Date)}</p>
        {offboardingBadge && (
          <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            {offboardingBadge}
          </span>
        )}
    </div>
    <div className="flex flex-col items-end gap-2">
      <StatusBadge status={employee.Employment_Status} />
      <p className="text-xs text-slate-500">{employee.Department ?? "—"}</p>
    </div>
  </button>
  );
};

export default EmployeeCard;

