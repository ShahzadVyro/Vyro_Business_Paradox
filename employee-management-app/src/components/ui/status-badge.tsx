"use client";

import type { EmploymentStatus } from "@/types/employee";
import clsx from "clsx";

const styleMap: Record<EmploymentStatus | "default", string> = {
  Active: "bg-emerald-100 text-emerald-700",
  "Resigned/Terminated": "bg-rose-100 text-rose-700",
  default: "bg-slate-100 text-slate-600",
};

const StatusBadge = ({ status }: { status?: EmploymentStatus }) => (
  <span
    className={clsx(
      "rounded-full px-3 py-1 text-xs font-semibold",
      status ? styleMap[status] : styleMap.default,
    )}
  >
    {status ?? "Unknown"}
  </span>
);

export default StatusBadge;

