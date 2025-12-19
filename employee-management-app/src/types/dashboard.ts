import type { EmployeeRecord, EmployeeOffboardingRecord } from "@/types/employee";
import type { SalaryRecord, EOBIRecord } from "@/types/api/payroll";

export type DashboardView = "directory" | "payroll" | "eobi" | "opd" | "tax" | "all" | "history";

export interface EmployeeSnapshot {
  directory: EmployeeRecord | null;
  salary: SalaryRecord | null;
  eobi: EOBIRecord | null;
}

export interface OffboardingNotification extends EmployeeOffboardingRecord {
  Full_Name: string;
  Department?: string | null;
  Designation?: string | null;
}


