import type { SalaryRecord, EOBIRecord } from "@/types/api/payroll";

export type EmploymentStatus = 'Active' | 'Resigned/Terminated';

export interface EmployeeRecord {
  Employee_ID: string;
  Full_Name: string;
  Official_Email: string | null;
  Personal_Email: string | null;
  Contact_Number: string | null;
  Department: string | null;
  Designation: string | null;
  Reporting_Manager: string | null;
  Employment_Status: EmploymentStatus;
  Employment_End_Date: string | null;
  Employment_End_Date_ISO?: string | null;
  Joining_Date: string | null;
  Joining_Date_ISO?: string | null;
  Probation_End_Date: string | null;
  Probation_End_Date_ISO?: string | null;
  Gross_Salary: number | null;
  Job_Location: string | null;
  Source_Sheet?: string | null;
  Date_of_Birth?: string | null;
  Date_of_Birth_ISO?: string | null;
  Spouse_DOB?: string | null;
  Spouse_DOB_ISO?: string | null;
  Offboarding_Status?: string | null;
  Offboarding_Date?: string | null;
  Offboarding_Date_ISO?: string | null;
  Offboarding_Note?: string | null;
}

export interface EmployeeFilters {
  search?: string;
  status?: EmploymentStatus;
  department?: string;
  limit?: number;
  offset?: number;
}

export interface EmployeeFullDetail {
  profile: EmployeeRecord | null;
  salary: SalaryRecord | null;
  eobi: EOBIRecord | null;
  history: EmployeeHistoryRecord[];
  offboarding: EmployeeOffboardingRecord | null;
}

export interface EmployeeHistoryRecord {
  Employee_ID: string;
  Full_Name?: string | null;
  Employment_Status: EmploymentStatus | string;
  Joining_Date: string | null;
  Employment_End_Date?: string | null;
  Department?: string | null;
  Designation?: string | null;
  Reporting_Manager?: string | null;
  Rejoin_Sequence?: number | null;
  Is_Current?: boolean | null;
  Record_Source?: string | null;
}

export interface EmployeeOffboardingRecord {
  Employee_ID: string;
  Offboarding_Status: "scheduled" | "completed" | "cancelled" | "active" | null;
  Employment_End_Date: string | null;
  Employment_End_Date_ISO?: string | null;
  Note?: string | null;
  Scheduled_By?: string | null;
  Updated_At?: string | null;
}

export type { SalaryRecord, EOBIRecord };

