export interface TaxCalculationRecord {
  Tax_ID: number;
  Employee_ID: number;
  Payroll_Month: string | null; // DATE as ISO string (can be null from BigQuery)
  Taxable_Income: number | null;
  Tax_Rate: number | null;
  Tax_Amount: number | null;
  Tax_Type: string | null;
  Tax_Bracket: string | null;
  Calculated_At: string | null;
  Comments: string | null;
  Created_At: string | null;
  // Enriched fields from Employees join
  Full_Name?: string | null;
  Designation?: string | null;
  Department?: string | null;
}

export interface TaxFilters {
  month?: string;
  employeeId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TaxListResponse {
  rows: TaxCalculationRecord[];
  total: number;
  months: Array<{ value: string; label: string }>;
  activeMonth?: string;
}


