"use client";

import { useMemo, useState } from "react";
import StatusBadge from "../ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { EmployeeFullDetail, EmploymentStatus } from "@/types/employee";
import type { DashboardView } from "@/types/dashboard";
import { updateEmploymentStatusClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCancelOffboarding, useScheduleOffboarding } from "@/hooks/use-offboarding";

interface Props {
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
  data?: EmployeeFullDetail | null;
  isLoading: boolean;
}

const statusOptions: EmploymentStatus[] = ["Active", "Resigned/Terminated"];

const VIEW_OPTIONS: { value: DashboardView; label: string }[] = [
  { value: "all", label: "All Fields" },
  { value: "directory", label: "Directory" },
  { value: "payroll", label: "Salaries" },
  { value: "eobi", label: "EOBI" },
];

const EmployeeDetail = ({ data, isLoading, view, onViewChange }: Props) => {
  const profile = data?.profile ?? null;
  const salary = data?.salary ?? null;
  const eobi = data?.eobi ?? null;
  const history = data?.history ?? [];
  const offboarding = data?.offboarding ?? null;

  if (isLoading) {
    return (
      <section className="rounded-4xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
        Loading employee…
      </section>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <DetailBody
      key={profile.Employee_ID}
      profile={profile}
      salary={salary}
      eobi={eobi}
      history={history}
      offboarding={offboarding}
      view={view}
      onViewChange={onViewChange}
    />
  );
};

const DetailBody = ({
  profile,
  salary,
  eobi,
  history,
  offboarding,
  view,
  onViewChange,
}: {
  profile: NonNullable<EmployeeFullDetail["profile"]>;
  salary: EmployeeFullDetail["salary"];
  eobi: EmployeeFullDetail["eobi"];
  history: EmployeeFullDetail["history"];
  offboarding: EmployeeFullDetail["offboarding"];
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
}) => {
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] = useState<EmploymentStatus>(profile.Employment_Status ?? "Active");

  const mutation = useMutation({
    mutationFn: (payload: { Employment_Status: EmploymentStatus }) =>
      updateEmploymentStatusClient(profile.Employee_ID, {
        Employment_Status: payload.Employment_Status,
        Employment_End_Date: payload.Employment_Status === "Resigned/Terminated" ? new Date().toISOString() : null,
        Reason: "Updated via Next.js dashboard",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee", profile.Employee_ID] });
    },
  });

  const headliner = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Employee #{profile.Employee_ID}</p>
        <h2 className="text-3xl font-semibold text-slate-900">{profile.Full_Name}</h2>
        <p className="text-sm text-slate-500">{profile.Designation ?? "—"}</p>
        <p className="text-sm text-slate-400">{profile.Department ?? "—"}</p>
      </div>
      <StatusBadge status={profile.Employment_Status} />
    </div>
  );

  const statusControl = (
    <div className="mt-6 rounded-3xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm font-semibold text-slate-900">Employment Status</p>
        <select
          value={nextStatus}
          onChange={(event) => setNextStatus(event.target.value as EmploymentStatus)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={mutation.isPending || profile.Employment_Status === nextStatus}
          onClick={() => mutation.mutate({ Employment_Status: nextStatus })}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {mutation.isPending ? "Updating…" : "Update"}
        </button>
      </div>
    </div>
  );

  const viewContent = (() => {
    switch (view) {
      case "directory":
        return <DirectoryView profile={profile} />;
      case "payroll":
        return <SalaryView salary={salary} />;
      case "eobi":
        return <EobiView eobi={eobi} />;
      case "all":
      default:
        return <AllFieldsView profile={profile} salary={salary} eobi={eobi} />;
    }
  })();

  return (
    <section className="rounded-4xl bg-white p-8 shadow-2xl shadow-slate-200/60 ring-1 ring-slate-100">
      {headliner}
      {statusControl}
      <OffboardingPanel
        key={`${offboarding?.Employment_End_Date_ISO ?? offboarding?.Employment_End_Date ?? "none"}-${offboarding?.Note ?? ""}`}
        employeeId={profile.Employee_ID}
        offboarding={offboarding}
      />
      {history && history.length > 0 && <HistoryTimeline entries={history} />}
      <div className="mt-6 flex flex-wrap gap-2">
        {VIEW_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onViewChange(value)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              view === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-8">{viewContent}</div>
    </section>
  );
};

const DirectoryView = ({ profile }: { profile: NonNullable<EmployeeFullDetail["profile"]> }) => (
  <div className="grid gap-4 md:grid-cols-2">
    <Detail label="Official Email" value={profile.Official_Email} />
    <Detail label="Personal Email" value={profile.Personal_Email} />
    <Detail label="Joining Date" value={formatDate(profile.Joining_Date)} />
    <Detail label="Probation End" value={formatDate(profile.Probation_End_Date)} />
    <Detail label="Gross Salary" value={formatCurrency(profile.Gross_Salary)} />
    <Detail label="Reporting Manager" value={profile.Reporting_Manager} />
    <Detail label="Contact Number" value={profile.Contact_Number} />
    <Detail label="Job Location" value={profile.Job_Location} />
  </div>
);

const SalaryView = ({ salary }: { salary: EmployeeFullDetail["salary"] }) => {
  if (!salary) {
    return <Placeholder message="No salary records found for this teammate." />;
    }
  const summary = [
    { label: "Payroll Month", value: formatDate(salary.Payroll_Month ?? null) },
    { label: "Currency", value: salary.Currency },
    { label: "Regular Pay", value: formatCurrency(salary.Regular_Pay ?? null) },
    { label: "Gross Income", value: formatCurrency(salary.Gross_Income ?? null) },
    { label: "Net Income", value: formatCurrency(salary.Net_Income ?? null) },
    { label: "Tax Deduction", value: formatCurrency(salary.Tax_Deduction ?? null) },
    { label: "EOBI", value: formatCurrency(salary.EOBI ?? null) },
    { label: "Total Deductions", value: formatCurrency(salary.Deductions ?? null) },
  ];

  const prorated = [
    { label: "Prorated Base", value: formatCurrency(salary.Prorated_Base_Pay ?? null) },
    { label: "Prorated Medical", value: formatCurrency(salary.Prorated_Medical_Allowance ?? null) },
    { label: "Prorated Transport", value: formatCurrency(salary.Prorated_Transport_Allowance ?? null) },
    { label: "Prorated Inflation", value: formatCurrency(salary.Prorated_Inflation_Allowance ?? null) },
    { label: "Performance Bonus", value: formatCurrency(salary.Performance_Bonus ?? null) },
    { label: "Paid Overtime", value: formatCurrency(salary.Paid_Overtime ?? null) },
    { label: "Reimbursements", value: formatCurrency(salary.Reimbursements ?? null) },
    { label: "Other", value: formatCurrency(salary.Other_Adjustments ?? null) },
  ];

  return (
    <div className="space-y-8">
      <DetailSection title="Payout Summary" items={summary} />
      <DetailSection title="Prorated & Adjustments" items={prorated} />
      {(salary.Comments || salary.Additional_Points || salary.Shahzad_Comments) && (
        <div className="space-y-3">
          {salary.Comments && <NoteBlock title="Comments" text={salary.Comments} />}
          {salary.Additional_Points && <NoteBlock title="Additional Points" text={salary.Additional_Points} />}
          {salary.Shahzad_Comments && <NoteBlock title="Shahzad Comments" text={salary.Shahzad_Comments} />}
        </div>
      )}
    </div>
  );
};

const EobiView = ({ eobi }: { eobi: EmployeeFullDetail["eobi"] }) => {
  if (!eobi) {
    return <Placeholder message="No EOBI record found for this teammate." />;
  }

  const codes = [
    { label: "Area Code", value: eobi.EMP_AREA_CODE },
    { label: "Reg Serial", value: eobi.EMP_REG_SERIAL_NO },
    { label: "Sub Area", value: eobi.EMP_SUB_AREA_CODE },
    { label: "Sub Serial", value: eobi.EMP_SUB_SERIAL_NO },
  ];

  const timeline = [
    { label: "From", value: formatDate(eobi.From_Date ?? null) },
    { label: "To", value: formatDate(eobi.To_Date ?? null) },
    { label: "Days Worked", value: eobi.NO_OF_DAYS_WORKED ?? "—" },
  ];

  const contributions = [
    { label: "Employee Contribution", value: formatCurrency(eobi.Employee_Contribution ?? null) },
    { label: "Employer Contribution", value: formatCurrency(eobi.Employer_Contribution ?? null) },
    { label: "Total", value: formatCurrency(eobi.Total_EOBI ?? null) },
  ];

  return (
    <div className="space-y-8">
      <DetailSection title="Registration Codes" items={codes} />
      <DetailSection title="Coverage Period" items={timeline} />
      <DetailSection title="Contributions" items={contributions} />
    </div>
  );
};

const AllFieldsView = ({
  profile,
  salary,
  eobi,
}: {
  profile: NonNullable<EmployeeFullDetail["profile"]>;
  salary: EmployeeFullDetail["salary"];
  eobi: EmployeeFullDetail["eobi"];
}) => (
  <div className="space-y-10">
    <KeyValueDump title="Directory Fields" data={profile as unknown as Record<string, unknown>} />
    <KeyValueDump title="Salary Sheet Fields" data={salary as unknown as Record<string, unknown>} />
    <KeyValueDump title="EOBI Fields" data={eobi as unknown as Record<string, unknown>} />
  </div>
);

const DetailSection = ({ title, items }: { title: string; items: { label: string; value: string | number | null }[] }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {items.map(({ label, value }) => (
        <Detail key={label} label={label} value={value} />
      ))}
    </div>
  </div>
);

const NoteBlock = ({ title, text }: { title: string; text: string }) => (
  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
    <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
    <p className="mt-1 whitespace-pre-line">{text}</p>
  </div>
);

const KeyValueDump = ({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null | undefined;
}) => {
  if (!data) {
    return <Placeholder message={`No ${title.toLowerCase()} available.`} />;
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {Object.entries(data).map(([key, value]) => (
          <Detail key={key} label={toLabel(key)} value={normaliseValue(value)} />
        ))}
      </div>
    </div>
  );
};

const Placeholder = ({ message }: { message: string }) => (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-400">
    {message}
  </div>
);

const Detail = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 font-semibold text-slate-900">{value ?? "—"}</p>
  </div>
);

const toLabel = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/\b([a-z])/gi, (match) => match.toUpperCase())
    .replace(/\s+/g, " ");

const normaliseValue = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    if (!value.trim()) return "—";
    if (!Number.isNaN(Date.parse(value)) && value.length >= 8) {
      const formatted = formatDate(value);
      return formatted;
    }
    return value;
  }
  return String(value);
};

const HistoryTimeline = ({ entries }: { entries: EmployeeFullDetail["history"] }) => {
  if (!entries || entries.length === 0) {
    return null;
  }
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">Employment timeline</p>
      <div className="mt-4 space-y-3">
        {entries.map((record) => (
          <div key={`${record.Employee_ID}-${record.Rejoin_Sequence ?? 0}`} className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Cycle {record.Rejoin_Sequence ?? "—"} · {record.Employment_Status ?? "—"}
                </p>
                <p className="text-xs text-slate-500">{record.Record_Source ?? "Employee Directory"}</p>
              </div>
              {record.Is_Current && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">Current</span>
              )}
            </div>
            <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Joining Date</p>
                <p className="font-semibold">{formatDate(record.Joining_Date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">End Date</p>
                <p className="font-semibold">{formatDate(record.Employment_End_Date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Department</p>
                <p className="font-semibold">{record.Department ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Designation</p>
                <p className="font-semibold">{record.Designation ?? "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const OffboardingPanel = ({
  employeeId,
  offboarding,
}: {
  employeeId: string;
  offboarding: EmployeeFullDetail["offboarding"];
}) => {
  const initialDate = offboarding?.Employment_End_Date_ISO ?? offboarding?.Employment_End_Date ?? "";
  const [date, setDate] = useState(() => initialDate);
  const [note, setNote] = useState(() => offboarding?.Note ?? "");
  const scheduleMutation = useScheduleOffboarding(employeeId);
  const cancelMutation = useCancelOffboarding(employeeId);
  const feedback =
    scheduleMutation.isSuccess && !scheduleMutation.isPending
      ? "Exit scheduled successfully."
      : cancelMutation.isSuccess && !cancelMutation.isPending
        ? "Exit cancelled and employee retained."
        : null;

  const badge = useMemo(() => {
    if (!offboarding?.Employment_End_Date_ISO) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (offboarding.Employment_End_Date_ISO === today) {
      return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Leaving today</span>;
    }
    if (offboarding.Offboarding_Status === "scheduled") {
      return (
        <span className="rounded-full bg-slate-900/10 px-3 py-1 text-xs font-semibold text-slate-900">
          Leaving on {formatDate(offboarding.Employment_End_Date_ISO)}
        </span>
      );
    }
    return null;
  }, [offboarding]);

  return (
    <div className="mt-6 rounded-3xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Offboarding</p>
          <p className="text-xs text-slate-500">Schedule or cancel the employee&rsquo;s last working day.</p>
        </div>
        {badge}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr,1fr]">
        <label className="flex flex-col text-sm font-semibold text-slate-700">
          Employment end date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700"
          />
        </label>
        <label className="flex flex-col text-sm font-semibold text-slate-700">
          Notes
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional context"
            className="mt-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!date || scheduleMutation.isPending}
          onClick={() => scheduleMutation.mutate({ Employment_End_Date: date, Note: note || undefined })}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {scheduleMutation.isPending ? "Scheduling…" : "Schedule exit"}
        </button>
        {offboarding && (
          <button
            type="button"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelMutation.isPending ? "Updating…" : "Retain employee"}
          </button>
        )}
      </div>
      {feedback && <p className="mt-3 text-xs font-semibold text-emerald-600">{feedback}</p>}
    </div>
  );
};


export default EmployeeDetail;

