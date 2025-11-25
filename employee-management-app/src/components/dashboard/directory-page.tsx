"use client";

import EmployeeDashboard from "@/components/dashboard/employee-dashboard";
import DownloadButton from "@/components/ui/download-button";

const DirectoryPage = () => {
  const downloads = [
    { label: "Download All", href: "/api/employees?format=csv" },
    { label: "Active Only", href: "/api/employees?status=Active&format=csv" },
    {
      label: "Resigned/Terminated",
      href: `/api/employees?status=${encodeURIComponent("Resigned/Terminated")}&format=csv`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="rounded-4xl border border-slate-200 bg-white/70 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400">Employee Directory</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">People records synced from BigQuery</h1>
        <p className="mt-2 text-sm text-slate-500">
          Search, filter, and update employee status. Use the download shortcuts to export the exact sheets that used to
          live in Excel.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {downloads.map((entry) => (
            <DownloadButton key={entry.href} label={entry.label} href={entry.href} />
          ))}
        </div>
      </header>

      <EmployeeDashboard />
    </div>
  );
};

export default DirectoryPage;


