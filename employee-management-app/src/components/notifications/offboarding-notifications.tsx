"use client";

import { useOffboardingNotifications } from "@/hooks/use-offboarding";
import { formatDate } from "@/lib/formatters";
import type { OffboardingNotification } from "@/types/dashboard";

const OffboardingNotifications = () => {
  const { data, isLoading } = useOffboardingNotifications();

  return (
    <section className="rounded-4xl bg-white p-6 shadow-2xl shadow-slate-200/60 ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">People Ops</p>
          <h1 className="text-3xl font-semibold text-slate-900">Offboarding notifications</h1>
        </div>
      </div>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-400">Loading notifications…</p>
      ) : (
        <div className="mt-6 space-y-8">
          <NotificationSection title="Leavers today" data={data?.today ?? []} empty="No scheduled exits today." highlight />
          <NotificationSection title="Upcoming leavers" data={data?.upcoming ?? []} empty="No upcoming exits." />
        </div>
      )}
    </section>
  );
};

const NotificationSection = ({
  title,
  data,
  empty,
  highlight = false,
}: {
  title: string;
  data: OffboardingNotification[];
  empty: string;
  highlight?: boolean;
}) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
    {data.length === 0 ? (
      <p className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-400">{empty}</p>
    ) : (
      <div className="mt-3 space-y-3">
        {data.map((entry) => (
          <div
            key={`${entry.Employee_ID}-${entry.Employment_End_Date_ISO}`}
            className={`rounded-3xl border border-slate-100 p-4 ${highlight ? "bg-amber-50" : "bg-slate-50"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-slate-900">{entry.Full_Name}</p>
                <p className="text-sm text-slate-500">{entry.Designation ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Last working day</p>
                <p className="text-sm font-semibold text-slate-900">{formatDate(entry.Employment_End_Date_ISO)}</p>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-600">
              <p>Department: {entry.Department ?? "—"}</p>
              {entry.Note && <p className="text-slate-500">Note: {entry.Note}</p>}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default OffboardingNotifications;


