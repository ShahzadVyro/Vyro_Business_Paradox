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

export interface PayTemplateNewHire {
  Employee_ID?: string | null;
  Employee_Name: string;
  Designation?: string | null;
  Official_Email?: string | null;
  Date_of_Joining: string;
  Currency: string;
  Salary: number;
  Employment_Location?: string | null;
  Bank_Name?: string | null;
  Bank_Account_Title?: string | null;
  Bank_Account_Number_IBAN?: string | null;
  Swift_Code_BIC?: string | null;
  Payroll_Month: string;
  Created_At?: string | null;
  Updated_At?: string | null;
  Employee_ID_Lookup?: boolean;
}

export interface PayTemplateLeaver {
  Employee_ID?: string | null;
  Employee_Name: string;
  Employment_End_Date: string;
  Payroll_Type: string;
  Payroll_Month: string;
  Created_At?: string | null;
  Updated_At?: string | null;
  Employee_ID_Lookup?: boolean;
}

export interface PayTemplateIncrement {
  Employee_ID?: string | null;
  Employee_Name: string;
  Currency: string;
  Previous_Salary?: number | null;
  Updated_Salary: number;
  Effective_Date: string;
  Comments?: string | null;
  Payroll_Month: string;
  Created_At?: string | null;
  Updated_At?: string | null;
  Employee_ID_Lookup?: boolean;
  Previous_Salary_Lookup?: boolean;
}

export interface PayTemplateConfirmation {
  Employee_ID?: string | null;
  Employee_Name: string;
  Probation_End_Date: string;
  Confirmation_Date: string;
  Currency?: string | null;
  Updated_Salary?: number | null;
  Payroll_Month: string;
  Created_At?: string | null;
  Updated_At?: string | null;
  Employee_ID_Lookup?: boolean;
}


