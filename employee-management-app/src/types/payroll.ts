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
  newJoiners?: number;
  probationsEnding?: Array<{
    Employee_ID: number;
    Full_Name: string;
    Department: string | null;
    Probation_End_Date: string;
    daysRemaining: number;
  }>;
  departmentBreakdown?: Array<{
    Department: string;
    activeCount: number;
    totalCount: number;
  }>;
  attrition?: {
    currentMonthRate: number;
    previousMonthRate: number;
    trend: 'up' | 'down' | 'stable';
    averageTenure: number;
  };
  pendingRequests?: {
    onboarding: number;
    changeRequests: number;
  };
  payroll: {
    month?: string;
    monthLabel?: string;
    totals: PayrollSummaryRow[];
  };
  eobi: EobiSummary;
  months: MonthOption[];
}


