import type { SalaryRecord, EOBIRecord } from "@/types/api/payroll";

export interface MonthOption {
  value: string;
  label: string;
}

export interface SalaryFilters {
  month?: string;
  currency?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SalaryListResponse {
  rows: SalaryRecord[];
  total: number;
  months: MonthOption[];
  activeMonth?: string;
}

export interface EobiFilters {
  month?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface EobiListResponse {
  rows: EOBIRecord[];
  total: number;
  months: MonthOption[];
  activeMonth?: string;
}

export interface PayrollSummaryRow {
  currency: string;
  headcount: number;
  netIncome: number;
  grossIncome: number;
}

export interface EobiSummary {
  headcount: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
}

export interface DashboardSummary {
  employees: {
    total: number;
    active: number;
    resigned: number;
  };
  payroll: {
    month?: string;
    monthLabel?: string;
    totals: PayrollSummaryRow[];
  };
  eobi: EobiSummary;
  months: MonthOption[];
}


