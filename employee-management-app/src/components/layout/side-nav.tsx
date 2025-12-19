"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Employee Directory", href: "/directory" },
  { label: "Salaries", href: "/salaries" },
  { label: "EOBI", href: "/eobi" },
  { label: "OPD Benefits", href: "/opd" },
  { label: "Tax Calculations", href: "/tax" },
  { label: "Pay Template", href: "/pay-template" },
  { label: "Notifications", href: "/notifications" },
  { label: "Submissions", href: "/submissions" },
  { label: "Onboarding", href: "/onboarding" },
];

const SideNav = () => {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white/70 px-4 py-6 backdrop-blur">
      <div className="px-3 py-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Vyro</p>
        <p className="text-lg font-semibold text-slate-900">People Ops</p>
      </div>
      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-900">Exports</p>
        <p>Download directory, payroll, and EOBI snapshots from each page.</p>
      </div>
    </aside>
  );
};

export default SideNav;


