"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/formatters";
import type { ChangeHistoryRecord } from "@/types/employee";

interface ChangeHistoryProps {
  employeeId: number;
}

const toLabel = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/\b([a-z])/gi, (match) => match.toUpperCase())
    .replace(/\s+/g, " ");

const formatValue = (value: string | null): string => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

export default function ChangeHistory({ employeeId }: ChangeHistoryProps) {
  const [history, setHistory] = useState<ChangeHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/employees/${employeeId}/history`);
        if (!response.ok) {
          throw new Error("Failed to fetch change history");
        }
        const data = await response.json();
        setHistory(data.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load change history");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [employeeId]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-400">
        Loading change history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-400">
        No change history available for this employee.
      </div>
    );
  }

  // Group changes by date
  const groupedByDate = history.reduce((acc, change) => {
    const date = change.Updated_Date || "Unknown";
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(change);
    return acc;
  }, {} as Record<string, ChangeHistoryRecord[]>);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-4">Change History</p>
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, changes]) => (
            <div key={date} className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">{formatDate(date)}</p>
              <div className="space-y-2 ml-4 border-l-2 border-slate-200 pl-4">
                {changes.map((change, idx) => (
                  <div
                    key={`${change.Field_Name}-${change.Updated_Date}-${idx}`}
                    className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-100"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{toLabel(change.Field_Name)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span className="font-medium">{formatValue(change.Old_Value)}</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-semibold text-slate-900">{formatValue(change.New_Value)}</span>
                        </div>
                        {change.Reason && (
                          <p className="mt-2 text-xs text-slate-500 italic">Reason: {change.Reason}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        {change.Updated_By && <p>By: {change.Updated_By}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
