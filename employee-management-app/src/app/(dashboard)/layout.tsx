import type { ReactNode } from "react";
import SideNav from "@/components/layout/side-nav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNav />
      <main className="flex-1 overflow-y-auto px-6 py-10 lg:px-10">{children}</main>
    </div>
  );
}


